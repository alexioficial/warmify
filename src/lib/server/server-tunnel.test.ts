import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import { loadServerTunnel, tunnelActions } from './server-tunnel';

const server = {
	uuid: 'server-1',
	name: 'Primary',
	ip: '198.51.100.8',
	is_coolify_host: false,
	settings: { is_reachable: true }
};

function event(values: Record<string, string> = {}) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		locals: { user: { username: 'admin' } },
		url: new URL('http://localhost/servers/server-1/cloudflare-tunnel'),
		request: new Request('http://localhost/servers/server-1/cloudflare-tunnel', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('tunnel loader projects only stored state and addresses', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce({
		is_cloudflare_tunnel: true,
		ip: '100.64.0.8',
		ip_previous: '198.51.100.8',
		tunnel_token: 'tunnel-secret'
	});
	const result = await loadServerTunnel(event());
	expect(result.tunnel).toEqual({
		enabled: true,
		ip: '100.64.0.8',
		previousIp: '198.51.100.8'
	});
	expect(JSON.stringify(result)).not.toContain('tunnel-secret');
});

test.each([
	['enable', 'ENABLE TUNNEL', '/servers/server-1/cloudflare-tunnel/enable'],
	['disable', 'DISABLE TUNNEL', '/servers/server-1/cloudflare-tunnel/disable']
])(
	'%s requires typed confirmation and sends one exact POST',
	async (operation, phrase, endpoint) => {
		expect(await tunnelActions[operation as 'enable' | 'disable'](event())).toMatchObject({
			status: 400
		});
		expect(request).not.toHaveBeenCalled();

		request.mockResolvedValueOnce(server).mockResolvedValueOnce({ message: 'upstream-secret' });
		const result = await tunnelActions[operation as 'enable' | 'disable'](
			event({ confirmation: phrase })
		);
		expect(request.mock.calls).toEqual([
			['GET', '/servers/server-1'],
			['POST', endpoint]
		]);
		expect(result).toEqual({
			message: `Cloudflare Tunnel stored state ${operation === 'enable' ? 'enabled' : 'disabled'}.`
		});
		expect(JSON.stringify(result)).not.toContain('upstream-secret');
	}
);

test('local Coolify host is rejected before a tunnel POST', async () => {
	request.mockResolvedValueOnce({ ...server, is_coolify_host: true });
	const result = await tunnelActions.enable(event({ confirmation: 'ENABLE TUNNEL' }));
	expect(result).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
});
