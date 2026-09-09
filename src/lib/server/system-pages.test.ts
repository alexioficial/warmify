import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit }));

import { loadSystemPage, systemActions } from './system-pages';

function event(action: string, confirmation: string) {
	const form = new FormData();
	form.set('confirmation', confirmation);
	return {
		locals: { user: { username: 'admin' } },
		setHeaders: vi.fn(),
		url: new URL(`http://localhost/system?/${action}`),
		request: new Request(`http://localhost/system?/${action}`, {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	audit.mockReset();
});

test('loads health, plain-text version and root-team capability without claiming toggle state', async () => {
	request
		.mockResolvedValueOnce('OK')
		.mockResolvedValueOnce('v4.3.14-4')
		.mockResolvedValueOnce({ id: 0, name: 'Root Team' });
	const setHeaders = vi.fn();
	const result = await loadSystemPage(setHeaders);
	expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store' });
	expect(result).toMatchObject({
		health: 'OK',
		version: 'v4.3.14-4',
		apiAvailable: true,
		rootTeam: true,
		apiState: 'unavailable',
		mcpState: 'unavailable'
	});
	expect(request.mock.calls.map((call) => call.slice(0, 2))).toEqual([
		['GET', '/health'],
		['GET', '/version'],
		['GET', '/team']
	]);
});

test('keeps API recovery available when health works but protected reads fail', async () => {
	request
		.mockResolvedValueOnce('OK')
		.mockRejectedValueOnce(new Error('disabled'))
		.mockRejectedValueOnce(new Error('disabled'));
	const result = await loadSystemPage(vi.fn());
	expect(result).toMatchObject({
		health: 'OK',
		version: 'Unavailable',
		apiAvailable: false,
		rootTeam: null
	});
});

test('enables the API directly so a disabled API can recover', async () => {
	request.mockResolvedValue({ message: 'upstream-enable-response-secret' });
	const result = await systemActions.enableApi(event('enableApi', 'ENABLE API'));
	expect(request).toHaveBeenCalledWith('POST', '/enable');
	expect(result).toMatchObject({ message: 'Coolify API enable request completed.' });
	expect(JSON.stringify(result)).not.toContain('upstream-enable-response-secret');
});

test('requires exact API-disable confirmation before the fresh root-team check', async () => {
	const result = await systemActions.disableApi(event('disableApi', 'wrong'));
	expect(result).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});

test('disables API only after checking the current token belongs to team zero', async () => {
	request
		.mockResolvedValueOnce({ id: 0, name: 'Root Team' })
		.mockResolvedValueOnce({ message: 'upstream-disable-response-secret' });
	const result = await systemActions.disableApi(event('disableApi', 'DISABLE API'));
	expect(request).toHaveBeenNthCalledWith(1, 'GET', '/team');
	expect(request).toHaveBeenNthCalledWith(2, 'POST', '/disable');
	expect(result).toMatchObject({
		message: 'Coolify API disabled. Warmify cannot manage resources until it is enabled again.'
	});
	expect(JSON.stringify(result)).not.toContain('upstream-disable-response-secret');
});

test('rejects MCP changes for non-root-team tokens', async () => {
	request.mockResolvedValueOnce({ id: 1, name: 'Another Team' });
	const result = await systemActions.enableMcp(event('enableMcp', 'ENABLE MCP'));
	expect(result).toMatchObject({ status: 403 });
	expect(request).toHaveBeenCalledTimes(1);
});

test.each([
	['enableMcp', 'ENABLE MCP', '/mcp/enable', 'Coolify MCP server enable request completed.'],
	['disableMcp', 'DISABLE MCP', '/mcp/disable', 'Coolify MCP server disable request completed.']
])(
	'%s uses root permission and its documented endpoint',
	async (action, confirmation, path, message) => {
		request
			.mockResolvedValueOnce({ id: 0, name: 'Root Team' })
			.mockResolvedValueOnce({ message: 'ok' });
		const result = await systemActions[action as 'enableMcp' | 'disableMcp'](
			event(action, confirmation)
		);
		expect(request).toHaveBeenNthCalledWith(2, 'POST', path);
		expect(result).toMatchObject({ message });
	}
);
