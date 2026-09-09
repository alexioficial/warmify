import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import { dockerCleanupActions, loadDockerCleanup } from './server-docker-cleanup';

const server = {
	uuid: 'server-1',
	name: 'Primary',
	settings: { is_reachable: true, token: 'server-settings-secret' }
};
const settings = {
	docker_cleanup_frequency: '0 3 * * *',
	docker_cleanup_threshold: 80,
	force_docker_cleanup: false,
	delete_unused_volumes: true,
	delete_unused_networks: false,
	disable_application_image_retention: false,
	secret: 'cleanup-settings-secret'
};

function event(values: Record<string, string> = {}, user = true, origin = 'http://localhost') {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		locals: { user: user ? { username: 'admin' } : null },
		url: new URL('http://localhost/servers/server-1/docker-cleanup'),
		setHeaders: vi.fn(),
		request: new Request('http://localhost/servers/server-1/docker-cleanup', {
			method: 'POST',
			headers: { origin },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('cleanup loader projects settings and bounded executions without secret fields', async () => {
	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce(settings)
		.mockResolvedValueOnce([
			{
				uuid: 'cleanup-1',
				status: 'success',
				message: 'Removed unused images',
				created_at: '2026-09-04T12:00:00Z',
				finished_at: '2026-09-04T12:00:04Z',
				secret: 'execution-secret'
			}
		]);
	const current = event();
	const result = await loadDockerCleanup(current);

	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/docker-cleanup'],
		['GET', '/servers/server-1/docker-cleanup/executions']
	]);
	expect(result.settings).toEqual(settingsWithoutSecret());
	expect(result.executions).toHaveLength(1);
	expect(JSON.stringify(result)).not.toMatch(/settings-secret|execution-secret/);
	expect(current.setHeaders).not.toHaveBeenCalled();
});

test('cleanup settings validate before API and PATCH one exact allowlist', async () => {
	const invalid = await dockerCleanupActions.update(
		event({ docker_cleanup_frequency: '', docker_cleanup_threshold: '100' })
	);
	expect(invalid).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();

	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce({ ...settings, secret: 'response-secret' });
	const result = await dockerCleanupActions.update(
		event({
			docker_cleanup_frequency: 'daily',
			docker_cleanup_threshold: '75',
			force_docker_cleanup: 'true',
			delete_unused_volumes: 'false',
			delete_unused_networks: 'true',
			disable_application_image_retention: 'true',
			foreign: 'ignored'
		})
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1/docker-cleanup', {
		body: {
			docker_cleanup_frequency: 'daily',
			docker_cleanup_threshold: 75,
			force_docker_cleanup: true,
			delete_unused_volumes: false,
			delete_unused_networks: true,
			disable_application_image_retention: true
		}
	});
	expect(result).toEqual({ message: 'Docker cleanup settings saved.' });
	expect(JSON.stringify(result)).not.toContain('response-secret');
});

test('manual cleanup needs confirmation before one exact non-retried POST', async () => {
	const rejected = await dockerCleanupActions.run(event({ delete_unused_volumes: 'true' }));
	expect(rejected).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();

	request.mockResolvedValueOnce(server).mockResolvedValueOnce({ message: 'upstream-secret' });
	const result = await dockerCleanupActions.run(
		event({
			confirmation: 'RUN CLEANUP',
			delete_unused_volumes: 'true',
			delete_unused_networks: 'false'
		})
	);
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		[
			'POST',
			'/servers/server-1/docker-cleanup/run',
			{ body: { delete_unused_volumes: true, delete_unused_networks: false } }
		]
	]);
	expect(result).toEqual({ message: 'Docker cleanup started.' });
	expect(JSON.stringify(result)).not.toContain('upstream-secret');
});

function settingsWithoutSecret() {
	return {
		frequency: '0 3 * * *',
		threshold: 80,
		force: false,
		deleteUnusedVolumes: true,
		deleteUnusedNetworks: false,
		disableImageRetention: false
	};
}
