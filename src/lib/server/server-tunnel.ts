import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';

function path(uuid: string, suffix = '') {
	if (!validId(uuid)) error(404, 'Server not found.');
	return `/servers/${encodeURIComponent(uuid)}/cloudflare-tunnel${suffix}`;
}

export function serverTunnelView(value: unknown) {
	const row = asRecord(value) ?? {};
	return {
		enabled: flag(row.is_cloudflare_tunnel),
		ip: firstText(row, ['ip']),
		previousIp: firstText(row, ['ip_previous'])
	};
}

export async function loadServerTunnel(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	try {
		const result = await getCoolifyClient().request('GET', path(uuid));
		return { tunnel: serverTunnelView(result), requestError: '' };
	} catch {
		return {
			tunnel: serverTunnelView({}),
			requestError: 'Cloudflare Tunnel state could not be loaded.'
		};
	}
}

function status(caught: unknown) {
	const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return candidate >= 400 && candidate <= 599 ? candidate : 500;
}

async function toggle(event: RequestEvent, operation: 'enable' | 'disable') {
	const started = Date.now();
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		const form = await event.request.formData();
		const phrase = operation === 'enable' ? 'ENABLE TUNNEL' : 'DISABLE TUNNEL';
		if (String(form.get('confirmation') ?? '') !== phrase)
			error(400, `Type ${phrase} exactly to confirm.`);
		const uuid = event.params.uuid ?? '';
		const { server } = await loadServer(uuid);
		if (server.isCoolifyHost)
			error(400, 'Cloudflare Tunnel cannot be configured on the local Coolify host.');
		await getCoolifyClient().request('POST', path(uuid, `/${operation}`));
		audit({
			user: event.locals.user.username,
			operation: `${operation}-server-cloudflare-tunnel`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return {
			message: `Cloudflare Tunnel stored state ${operation === 'enable' ? 'enabled' : 'disabled'}.`
		};
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation: `${operation}-server-cloudflare-tunnel`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			error: 'The Cloudflare Tunnel state could not be changed. Check the server and try again.'
		});
	}
}

export const tunnelActions = {
	enable: (event: RequestEvent) => toggle(event, 'enable'),
	disable: (event: RequestEvent) => toggle(event, 'disable')
};
