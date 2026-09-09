import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import { loadServerProxy, proxyActions, revealProxyConfiguration } from './server-proxy';

const server = { uuid: 'server-1', name: 'Primary', settings: { is_reachable: true } };
const proxy = {
	proxy_type: 'TRAEFIK',
	status: 'running',
	redirect_enabled: true,
	redirect_url: 'https://example.com',
	generate_exact_labels: false,
	configuration: 'services:\n  proxy:\n    secret: proxy-compose-secret'
};

function event(
	values: Record<string, string> = {},
	json = false,
	user = true,
	origin = 'http://localhost'
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		locals: { user: user ? { username: 'admin' } : null },
		url: new URL('http://localhost/servers/server-1/proxy'),
		request: new Request('http://localhost/servers/server-1/proxy', {
			method: 'POST',
			headers: { origin, ...(json ? { 'content-type': 'application/json' } : {}) },
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('proxy loader exposes metadata but never raw configuration', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce(proxy);
	const result = await loadServerProxy(event());
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/proxy']
	]);
	expect(result.proxy).toEqual({
		type: 'traefik',
		status: 'running',
		redirectEnabled: true,
		redirectUrl: 'https://example.com',
		generateExactLabels: false,
		configurationAvailable: true
	});
	expect(JSON.stringify(result)).not.toContain('proxy-compose-secret');
});

test('proxy settings validate the redirect and PATCH one exact allowlist', async () => {
	const invalid = await proxyActions.update(
		event({ redirect_url: 'javascript:alert(1)', proxy_type: 'traefik' })
	);
	expect(invalid).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();

	request.mockResolvedValueOnce(server).mockResolvedValueOnce(proxy);
	const result = await proxyActions.update(
		event({
			redirect_enabled: 'true',
			redirect_url: 'https://redirect.example.com/path',
			generate_exact_labels: 'false',
			proxy_type: 'caddy',
			configuration: 'forged'
		})
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1/proxy', {
		body: {
			redirect_enabled: true,
			redirect_url: 'https://redirect.example.com/path',
			generate_exact_labels: false,
			proxy_type: 'caddy'
		}
	});
	expect(result).toEqual({ message: 'Proxy settings saved.' });
});

test('proxy configuration is sent once as base64 and never serialized back', async () => {
	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce({ ...proxy, secret: 'response-secret' });
	const result = await proxyActions.saveConfiguration(
		event({ configuration: 'services:\n  proxy:\n    image: traefik:v3' })
	);
	expect(request).toHaveBeenLastCalledWith('PUT', '/servers/server-1/proxy/configuration', {
		body: {
			configuration: Buffer.from('services:\n  proxy:\n    image: traefik:v3', 'utf8').toString(
				'base64'
			)
		}
	});
	expect(result).toEqual({ message: 'Proxy configuration saved.' });
	expect(JSON.stringify(result)).not.toMatch(/traefik:v3|response-secret/);
});

test('proxy restart requires a fresh typed confirmation before one POST', async () => {
	expect(await proxyActions.restart(event())).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();

	request.mockResolvedValueOnce(server).mockResolvedValueOnce({ message: 'upstream-secret' });
	const result = await proxyActions.restart(event({ confirmation: 'RESTART PROXY' }));
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['POST', '/servers/server-1/proxy/restart']
	]);
	expect(result).toEqual({ message: 'Proxy restart queued.' });
});

test('proxy configuration reveal is explicit, no-store and returns only configuration', async () => {
	const denied = await revealProxyConfiguration(event({}, true, false));
	expect(denied.status).toBe(401);
	expect(request).not.toHaveBeenCalled();

	request.mockResolvedValueOnce(server).mockResolvedValueOnce(proxy);
	const result = await revealProxyConfiguration(event({}, true));
	expect(result.headers.get('cache-control')).toBe('no-store');
	expect(await result.json()).toEqual({ configuration: proxy.configuration });
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/proxy']
	]);
});
