import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));

import { createServerAction, loadServerCreation, privateKeyView } from './server-creation';

const keys = [
	{
		uuid: 'key-1',
		name: 'Production key',
		description: 'SSH access',
		private_key: 'fixture-private-key'
	}
];

function event(values: Record<string, string>, origin = 'http://localhost') {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		locals: { user: { username: 'admin' } },
		url: new URL('http://localhost/servers/new'),
		request: new Request('http://localhost/servers/new?/createServer', {
			method: 'POST',
			headers: { origin },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	invalidate.mockReset();
});

test('private-key presenter and loader expose no key material', async () => {
	expect(privateKeyView(keys[0])).toEqual({
		uuid: 'key-1',
		name: 'Production key',
		description: 'SSH access'
	});
	request.mockResolvedValue(keys);
	const result = await loadServerCreation(vi.fn());
	expect(request).toHaveBeenCalledWith('GET', '/security/keys');
	expect(result.keys).toEqual([privateKeyView(keys[0])]);
	expect(JSON.stringify(result)).not.toContain('fixture-private-key');
});

test('server creation validates locally and requires a current team key', async () => {
	request.mockResolvedValue(keys);
	const rejected = await createServerAction(
		event({ ip: 'not a host!', private_key_uuid: 'forged-key', port: '22', user: 'root' })
	);
	expect(rejected).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();

	const staleKey = await createServerAction(
		event({ ip: 'server.example.com', private_key_uuid: 'forged-key', port: '22', user: 'root' })
	);
	expect(staleKey).toMatchObject({ status: 400 });
	expect(request.mock.calls).toEqual([['GET', '/security/keys']]);
});

test('server creation sends one allowlisted request and redirects to the new server', async () => {
	request.mockResolvedValueOnce(keys).mockResolvedValueOnce({
		uuid: 'server-new',
		private_key: 'response-secret'
	});
	await expect(
		createServerAction(
			event({
				name: 'Edge host',
				description: 'Production edge',
				ip: '2001:db8::10',
				port: '2222',
				user: 'deploy_user',
				private_key_uuid: 'key-1',
				is_build_server: 'true',
				instant_validate: 'true',
				proxy_type: 'caddy',
				forged: 'ignored'
			})
		)
	).rejects.toMatchObject({ status: 303, location: '/servers/server-new/general' });
	expect(request.mock.calls).toEqual([
		['GET', '/security/keys'],
		[
			'POST',
			'/servers',
			{
				body: {
					name: 'Edge host',
					description: 'Production edge',
					ip: '2001:db8::10',
					port: 2222,
					user: 'deploy_user',
					private_key_uuid: 'key-1',
					is_build_server: true,
					instant_validate: true,
					proxy_type: 'caddy'
				}
			}
		]
	]);
	expect(invalidate).toHaveBeenCalledWith('servers');
});

test('server creation rejects cross-origin posts before contacting Coolify', async () => {
	const result = await createServerAction(
		event(
			{ ip: 'server.example.com', private_key_uuid: 'key-1', port: '22', user: 'root' },
			'https://attacker.example'
		)
	);
	expect(result).toMatchObject({ status: 403 });
	expect(request).not.toHaveBeenCalled();
});
