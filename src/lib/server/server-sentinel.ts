import { error, fail, isHttpError, json, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const formFlag = (form: FormData, name: string) => flag(form.getAll(name).at(-1));

function path(uuid: string) {
	if (!validId(uuid)) error(404, 'Server not found.');
	return `/servers/${encodeURIComponent(uuid)}/sentinel`;
}

function integer(value: unknown, fallback: number) {
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : fallback;
}

export function serverSentinelView(value: unknown) {
	const row = asRecord(value) ?? {};
	return {
		enabled: flag(row.is_sentinel_enabled),
		metricsEnabled: flag(row.is_metrics_enabled),
		debugEnabled: flag(row.is_sentinel_debug_enabled),
		refreshRate: integer(row.sentinel_metrics_refresh_rate_seconds, 10),
		historyDays: integer(row.sentinel_metrics_history_days, 7),
		pushInterval: integer(row.sentinel_push_interval_seconds, 30),
		updatedAt: firstText(row, ['sentinel_updated_at']),
		tokenConfigured: typeof row.sentinel_token === 'string' && row.sentinel_token.length > 0,
		customUrlConfigured:
			typeof row.sentinel_custom_url === 'string' && row.sentinel_custom_url.length > 0
	};
}

export async function loadServerSentinel(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	try {
		const result = await getCoolifyClient().request('GET', path(uuid));
		return { sentinel: serverSentinelView(result), requestError: '' };
	} catch {
		return {
			sentinel: serverSentinelView({}),
			requestError: 'Sentinel settings could not be loaded.'
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

function requiredInteger(form: FormData, name: string, minimum: number) {
	const number = Number(form.get(name));
	if (!Number.isSafeInteger(number) || number < minimum)
		error(400, 'Enter valid Sentinel timing values.');
	return number;
}

function optionalUrl(value: string) {
	try {
		const parsed = new URL(value);
		if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
			throw new Error('Unsafe URL.');
		return parsed.toString();
	} catch {
		error(400, 'Enter a valid HTTP or HTTPS Sentinel URL.');
	}
}

export const sentinelActions = {
	update: async (event: RequestEvent) => {
		const started = Date.now();
		try {
			assertMutation(event);
			const form = await event.request.formData();
			if (String(form.get('confirmation') ?? '') !== 'SAVE SENTINEL')
				error(400, 'Type SAVE SENTINEL exactly to confirm changes.');
			const enabled = formFlag(form, 'is_sentinel_enabled');
			const token = String(form.get('sentinel_token') ?? '').trim();
			const customUrlMode = String(form.get('sentinel_custom_url_mode') ?? 'keep');
			const customUrl = String(form.get('sentinel_custom_url') ?? '').trim();
			if (token && (token.length > 500 || !/^[A-Za-z0-9._\-+=/]+$/.test(token)))
				error(400, 'Enter a valid Sentinel token.');
			if (!['keep', 'replace', 'clear'].includes(customUrlMode))
				error(400, 'Select keep, replace or clear for the custom URL.');
			if (customUrlMode === 'replace' && !customUrl)
				error(400, 'Enter a custom Sentinel URL or select keep/clear.');
			const body: Record<string, unknown> = {
				is_sentinel_enabled: enabled,
				is_metrics_enabled: enabled && formFlag(form, 'is_metrics_enabled'),
				is_sentinel_debug_enabled: enabled && formFlag(form, 'is_sentinel_debug_enabled'),
				sentinel_metrics_refresh_rate_seconds: requiredInteger(
					form,
					'sentinel_metrics_refresh_rate_seconds',
					1
				),
				sentinel_metrics_history_days: requiredInteger(form, 'sentinel_metrics_history_days', 1),
				sentinel_push_interval_seconds: requiredInteger(form, 'sentinel_push_interval_seconds', 10)
			};
			if (token) body.sentinel_token = token;
			if (customUrlMode === 'replace') body.sentinel_custom_url = optionalUrl(customUrl);
			if (customUrlMode === 'clear') body.sentinel_custom_url = null;
			const uuid = event.params.uuid ?? '';
			const { server } = await loadServer(uuid);
			if (enabled && server.isBuildServer)
				error(400, 'Sentinel cannot be enabled on a build server.');
			await getCoolifyClient().request('PATCH', path(uuid), { body });
			audit({
				user: event.locals.user?.username,
				operation: 'update-server-sentinel',
				result: 'success',
				duration_ms: Date.now() - started
			});
			return { message: 'Sentinel settings saved.' };
		} catch (caught) {
			audit({
				user: event.locals.user?.username,
				operation: 'update-server-sentinel',
				result: 'error',
				duration_ms: Date.now() - started
			});
			return fail(status(caught), {
				error: 'Sentinel settings could not be saved. Check the values and try again.'
			});
		}
	}
};

export async function revealSentinelSecrets(event: RequestEvent) {
	const headers = { 'cache-control': 'no-store' };
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		await loadServer(uuid);
		const row = asRecord(await getCoolifyClient().request('GET', path(uuid)));
		if (
			!row ||
			(!Object.hasOwn(row, 'sentinel_token') && !Object.hasOwn(row, 'sentinel_custom_url'))
		)
			error(403, 'Sensitive Sentinel settings unavailable.');
		const token =
			typeof row.sentinel_token === 'string' || row.sentinel_token === null
				? row.sentinel_token
				: null;
		const customUrl =
			typeof row.sentinel_custom_url === 'string' || row.sentinel_custom_url === null
				? row.sentinel_custom_url
				: null;
		audit({
			user: event.locals.user?.username,
			operation: 'reveal-server-sentinel-secrets',
			result: 'secret-revealed'
		});
		return json({ token, customUrl }, { headers });
	} catch (caught) {
		const code = status(caught);
		return json(
			{
				message:
					code === 401
						? 'Authentication required.'
						: code === 403
							? 'Sensitive Sentinel settings unavailable. Sensitive-read permission is required.'
							: code === 404
								? 'Server not found.'
								: 'Sensitive Sentinel settings could not be revealed.'
			},
			{ status: code, headers }
		);
	}
}
