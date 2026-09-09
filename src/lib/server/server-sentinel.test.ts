import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import { loadServerSentinel, revealSentinelSecrets, sentinelActions } from './server-sentinel';

const server = {
	uuid: 'server-1',
	name: 'Primary',
	settings: { is_reachable: true, is_build_server: false }
};
const sentinel = {
	is_sentinel_enabled: true,
	is_metrics_enabled: true,
	is_sentinel_debug_enabled: false,
	sentinel_metrics_refresh_rate_seconds: 10,
	sentinel_metrics_history_days: 7,
	sentinel_push_interval_seconds: 30,
	sentinel_updated_at: '2026-09-04T12:00:00Z',
	sentinel_token: 'sentinel-token-secret',
	sentinel_custom_url: 'https://sentinel.example.com/private'
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
		url: new URL('http://localhost/servers/server-1/sentinel'),
		request: new Request('http://localhost/servers/server-1/sentinel', {
			method: 'POST',
			headers: { origin, ...(json ? { 'content-type': 'application/json' } : {}) },
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('Sentinel loader exposes safe state and only secret-presence flags', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce(sentinel);
	const result = await loadServerSentinel(event());
	expect(result.sentinel).toEqual({
		enabled: true,
		metricsEnabled: true,
		debugEnabled: false,
		refreshRate: 10,
		historyDays: 7,
		pushInterval: 30,
		updatedAt: '2026-09-04T12:00:00Z',
		tokenConfigured: true,
		customUrlConfigured: true
	});
	expect(JSON.stringify(result)).not.toMatch(/sentinel-token-secret|sentinel\.example/);
});

test('Sentinel update validates and sends only selected public fields', async () => {
	expect(await sentinelActions.update(event({ confirmation: 'SAVE SENTINEL' }))).toMatchObject({
		status: 400
	});
	expect(request).not.toHaveBeenCalled();

	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce({ ...sentinel, secret: 'response-secret' });
	const result = await sentinelActions.update(
		event({
			confirmation: 'SAVE SENTINEL',
			is_sentinel_enabled: 'true',
			is_metrics_enabled: 'true',
			is_sentinel_debug_enabled: 'false',
			sentinel_metrics_refresh_rate_seconds: '15',
			sentinel_metrics_history_days: '14',
			sentinel_push_interval_seconds: '45',
			sentinel_token: 'replacement.token-123',
			sentinel_custom_url_mode: 'replace',
			sentinel_custom_url: 'https://sentinel.example.com/new',
			foreign: 'ignored'
		})
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1/sentinel', {
		body: {
			is_sentinel_enabled: true,
			is_metrics_enabled: true,
			is_sentinel_debug_enabled: false,
			sentinel_metrics_refresh_rate_seconds: 15,
			sentinel_metrics_history_days: 14,
			sentinel_push_interval_seconds: 45,
			sentinel_token: 'replacement.token-123',
			sentinel_custom_url: 'https://sentinel.example.com/new'
		}
	});
	expect(result).toEqual({ message: 'Sentinel settings saved.' });
	expect(JSON.stringify(result)).not.toMatch(/replacement\.token|response-secret/);
});

test('Sentinel cannot be enabled on a build server and never reaches PATCH', async () => {
	request.mockResolvedValueOnce({ ...server, settings: { is_build_server: true } });
	const result = await sentinelActions.update(
		event({
			confirmation: 'SAVE SENTINEL',
			is_sentinel_enabled: 'true',
			sentinel_metrics_refresh_rate_seconds: '10',
			sentinel_metrics_history_days: '7',
			sentinel_push_interval_seconds: '30',
			sentinel_custom_url_mode: 'keep'
		})
	);
	expect(result).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'PATCH')).toBe(false);
});

test('Sentinel reveal is explicit and returns only sensitive fields with no-store', async () => {
	const denied = await revealSentinelSecrets(event({}, true, false));
	expect(denied.status).toBe(401);
	expect(request).not.toHaveBeenCalled();

	request.mockResolvedValueOnce(server).mockResolvedValueOnce(sentinel);
	const result = await revealSentinelSecrets(event({}, true));
	expect(result.headers.get('cache-control')).toBe('no-store');
	expect(await result.json()).toEqual({
		token: 'sentinel-token-secret',
		customUrl: 'https://sentinel.example.com/private'
	});
});
