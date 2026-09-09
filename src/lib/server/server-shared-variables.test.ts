import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import {
	loadServerSharedVariables,
	revealServerSharedVariable,
	serverSharedVariableActions
} from './shared-variables';

const server = {
	uuid: 'server-1',
	name: 'Local server',
	ip: '127.0.0.1',
	settings: { is_reachable: true, private_key: 'server-private-key' },
	proxy: { password: 'proxy-secret' }
};
const variable = {
	id: 7,
	key: 'API_KEY',
	value: 'stored-secret',
	comment: 'Server scope',
	is_literal: false,
	is_multiline: false,
	is_shown_once: false
};

function event(
	values: Record<string, string> = {},
	json = false,
	origin = 'http://localhost',
	user = true
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		url: new URL('http://localhost/servers/server-1/environment-variables'),
		locals: { user: user ? { username: 'admin' } : null },
		setHeaders: vi.fn(),
		request: new Request('http://localhost/servers/server-1/environment-variables', {
			method: 'POST',
			headers: { origin, ...(json ? { 'content-type': 'application/json' } : {}) },
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('server loader validates route ownership and never serializes secrets', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce([variable]);
	const current = event();
	const result = await loadServerSharedVariables(current);

	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/envs']
	]);
	expect(result.kind).toBe('server');
	expect(result.href).toBe('/servers/server-1');
	expect(result.revealHref).toBe('/servers/server-1/environment-variables/reveal');
	expect(JSON.stringify(result)).not.toMatch(/stored-secret|server-private-key|proxy-secret/);
	expect(current.setHeaders).not.toHaveBeenCalled();
});

test('server create sends only allowlisted fields to the route-owned scope', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce({ id: 8, value: 'response-secret' });
	const result = await serverSharedVariableActions.createVariable(
		event({ key: ' SERVER_KEY ', value: 'new-secret', server_uuid: 'foreign' })
	);

	expect(request).toHaveBeenLastCalledWith('POST', '/servers/server-1/envs', {
		body: {
			key: 'SERVER_KEY',
			value: 'new-secret',
			comment: null,
			is_literal: false,
			is_multiline: false,
			is_shown_once: false
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/new-secret|response-secret/);
});

test('server update verifies numeric variable ownership before the exact PATCH', async () => {
	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce([variable])
		.mockResolvedValueOnce({ ...variable, value: 'response-secret' });
	const result = await serverSharedVariableActions.updateVariable(
		event({ id: '7', key: 'RENAMED_KEY', value_mode: 'keep' })
	);

	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1/envs/7', {
		body: {
			key: 'RENAMED_KEY',
			comment: null,
			is_literal: false,
			is_multiline: false,
			is_shown_once: false
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/stored-secret|response-secret/);
});

test('server reveal uses its own physical route and returns only the selected value', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce([variable]);
	const result = await revealServerSharedVariable(event({ id: '7' }, true));

	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/envs']
	]);
	expect(result.headers.get('cache-control')).toBe('no-store');
	expect(await result.json()).toEqual({ value: 'stored-secret' });
});
