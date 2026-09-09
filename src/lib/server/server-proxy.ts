import { error, fail, isHttpError, json, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const formFlag = (form: FormData, name: string) => flag(form.getAll(name).at(-1));

function path(uuid: string, suffix = '') {
	if (!validId(uuid)) error(404, 'Server not found.');
	return `/servers/${encodeURIComponent(uuid)}/proxy${suffix}`;
}

export function serverProxyView(value: unknown) {
	const row = asRecord(value) ?? {};
	const type = firstText(row, ['proxy_type']).toLowerCase();
	return {
		type: ['traefik', 'caddy', 'nginx', 'none'].includes(type) ? type : 'none',
		status: firstText(row, ['status']) || 'unknown',
		redirectEnabled: flag(row.redirect_enabled),
		redirectUrl: firstText(row, ['redirect_url']),
		generateExactLabels: flag(row.generate_exact_labels),
		configurationAvailable: typeof row.configuration === 'string' && row.configuration.length > 0
	};
}

export async function loadServerProxy(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	try {
		const result = await getCoolifyClient().request('GET', path(uuid));
		return { proxy: serverProxyView(result), requestError: '' };
	} catch {
		return {
			proxy: serverProxyView({}),
			requestError: 'Proxy settings could not be loaded.'
		};
	}
}

function status(caught: unknown) {
	const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function redirectUrl(value: string) {
	if (!value) return null;
	try {
		const parsed = new URL(value);
		if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
			throw new Error('Unsafe redirect URL.');
		return parsed.toString();
	} catch {
		error(400, 'Enter a valid public HTTP or HTTPS redirect URL.');
	}
}

async function mutate(
	event: RequestEvent,
	operation: string,
	callback: (uuid: string, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		if (!validId(uuid)) error(404, 'Server not found.');
		const result = await callback(uuid, await event.request.formData());
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return result;
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			error: 'The proxy operation could not be completed. Check the settings and try again.'
		});
	}
}

export const proxyActions = {
	update: (event: RequestEvent) =>
		mutate(event, 'update-server-proxy', async (uuid, form) => {
			const type = String(form.get('proxy_type') ?? '').toLowerCase();
			if (!['traefik', 'caddy', 'nginx', 'none'].includes(type))
				error(400, 'Select a valid proxy type.');
			const body = {
				redirect_enabled: formFlag(form, 'redirect_enabled'),
				redirect_url: redirectUrl(String(form.get('redirect_url') ?? '').trim()),
				generate_exact_labels: formFlag(form, 'generate_exact_labels'),
				proxy_type: type
			};
			await loadServer(uuid);
			await getCoolifyClient().request('PATCH', path(uuid), { body });
			return { message: 'Proxy settings saved.' };
		}),
	saveConfiguration: (event: RequestEvent) =>
		mutate(event, 'save-server-proxy-configuration', async (uuid, form) => {
			const configuration = String(form.get('configuration') ?? '');
			if (!configuration.trim() || configuration.length > 1_000_000)
				error(400, 'Enter a proxy configuration up to 1 MB.');
			await loadServer(uuid);
			await getCoolifyClient().request('PUT', path(uuid, '/configuration'), {
				body: { configuration: Buffer.from(configuration, 'utf8').toString('base64') }
			});
			return { message: 'Proxy configuration saved.' };
		}),
	restart: (event: RequestEvent) =>
		mutate(event, 'restart-server-proxy', async (uuid, form) => {
			if (String(form.get('confirmation') ?? '') !== 'RESTART PROXY')
				error(400, 'Type RESTART PROXY exactly to confirm restart.');
			await loadServer(uuid);
			await getCoolifyClient().request('POST', path(uuid, '/restart'));
			return { message: 'Proxy restart queued.' };
		})
};

export async function revealProxyConfiguration(event: RequestEvent) {
	const headers = { 'cache-control': 'no-store' };
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		await loadServer(uuid);
		const row = asRecord(await getCoolifyClient().request('GET', path(uuid)));
		if (!row || typeof row.configuration !== 'string') error(403, 'Configuration unavailable.');
		audit({
			user: event.locals.user?.username,
			operation: 'reveal-server-proxy-configuration',
			result: 'secret-revealed'
		});
		return json({ configuration: row.configuration }, { headers });
	} catch (caught) {
		const code = status(caught);
		return json(
			{
				message:
					code === 401
						? 'Authentication required.'
						: code === 403
							? 'Configuration unavailable. Sensitive-read permission is required.'
							: code === 404
								? 'Server not found.'
								: 'Proxy configuration could not be revealed.'
			},
			{ status: code, headers }
		);
	}
}
