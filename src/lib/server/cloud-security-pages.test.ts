import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';

const request = vi.hoisted(() => vi.fn());
const collectionForPage = vi.hoisted(() => vi.fn());
const collectionSnapshotForPage = vi.hoisted(() =>
	vi.fn(async (...args: unknown[]) => ({
		value: await collectionForPage(...args),
		updatedAt: 1,
		fromCache: true,
		stale: false
	}))
);
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({
	collectionForPage,
	collectionSnapshotForPage,
	invalidateCollection: invalidate
}));

import {
	cloudInitActions,
	cloudTokenActions,
	createCloudInitScript,
	createCloudToken,
	loadCloudInitIndex,
	loadCloudInitScript,
	loadCloudToken,
	loadCloudTokenIndex
} from './cloud-security-pages';

const token = {
	uuid: 'token-1',
	name: 'Production Hetzner',
	provider: 'hetzner',
	team_id: 1,
	servers_count: 2,
	token: 'stored-provider-token-secret',
	created_at: '2026-09-04T00:00:00Z',
	updated_at: '2026-09-04T00:00:00Z'
};

const script = {
	uuid: 'script-1',
	name: 'Docker bootstrap',
	script: '#!/bin/sh\necho stored-cloud-init-secret',
	team_id: 1,
	created_at: '2026-09-04T00:00:00Z',
	updated_at: '2026-09-04T00:00:00Z'
};

function event(values: Record<string, string>, path: string, uuid = '') {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid },
		locals: { user: { username: 'admin' } },
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	collectionForPage.mockReset();
	invalidate.mockReset();
});

test('cached cloud indexes expose only explicit non-secret fields', async () => {
	collectionForPage.mockResolvedValueOnce([token]).mockResolvedValueOnce([script]);
	const tokens = await loadCloudTokenIndex(vi.fn());
	const scripts = await loadCloudInitIndex(vi.fn());
	expect(tokens.tokens[0]).toMatchObject({
		uuid: 'token-1',
		provider: 'hetzner',
		serversCount: 2
	});
	expect(scripts.scripts[0]).toMatchObject({ uuid: 'script-1', name: 'Docker bootstrap' });
	expect(JSON.stringify({ tokens, scripts })).not.toMatch(
		/stored-provider-token-secret|stored-cloud-init-secret/
	);
});

test('cloud token creation sends the exact allowlist and never returns the token', async () => {
	request.mockResolvedValueOnce({ uuid: 'token-created', token: 'response-provider-secret' });
	await expect(
		createCloudToken(
			event(
				{
					name: 'Production DigitalOcean',
					provider: 'digitalocean',
					token: 'submitted-provider-secret',
					forged: 'ignored'
				},
				'/security/cloud-tokens/new'
			)
		)
	).rejects.toMatchObject({
		status: 303,
		location: '/security/cloud-tokens/token-created/general'
	});
	expect(request).toHaveBeenCalledWith('POST', '/cloud-tokens', {
		body: {
			name: 'Production DigitalOcean',
			provider: 'digitalocean',
			token: 'submitted-provider-secret'
		}
	});
});

test('cloud token detail verifies identity and update changes only its name', async () => {
	request.mockResolvedValueOnce(token);
	const loaded = await loadCloudToken('token-1');
	expect(loaded.token).toMatchObject({ uuid: 'token-1', name: 'Production Hetzner' });
	expect(JSON.stringify(loaded)).not.toContain('stored-provider-token-secret');

	request.mockReset();
	request.mockResolvedValueOnce(token).mockResolvedValueOnce({ uuid: 'token-1' });
	await cloudTokenActions.update(
		event(
			{ name: 'Primary Hetzner', token: 'forged-rotation-secret', provider: 'vultr' },
			'/security/cloud-tokens/token-1/general',
			'token-1'
		)
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/cloud-tokens/token-1', {
		body: { name: 'Primary Hetzner' }
	});
});

test('cloud token validation and deletion return safe results', async () => {
	request.mockResolvedValueOnce(token).mockResolvedValueOnce({
		valid: false,
		message: 'provider-validation-secret'
	});
	const validation = await cloudTokenActions.validate(
		event({}, '/security/cloud-tokens/token-1/general', 'token-1')
	);
	expect(validation).toMatchObject({
		status: 422,
		data: { error: 'Cloud token validation failed. Check the provider credential.' }
	});
	expect(JSON.stringify(validation)).not.toContain('provider-validation-secret');

	request.mockReset();
	request.mockResolvedValueOnce(token);
	const inUse = await cloudTokenActions.delete(
		event(
			{ confirmation: 'Production Hetzner' },
			'/security/cloud-tokens/token-1/danger',
			'token-1'
		)
	);
	expect(inUse).toMatchObject({ status: 409 });
	expect(request).toHaveBeenCalledTimes(1);

	request.mockReset();
	request
		.mockResolvedValueOnce({ ...token, servers_count: 0 })
		.mockRejectedValueOnce(new CoolifyError('provider-delete-secret', 500));
	const failed = await cloudTokenActions.delete(
		event(
			{ confirmation: 'Production Hetzner' },
			'/security/cloud-tokens/token-1/danger',
			'token-1'
		)
	);
	expect(failed).toMatchObject({
		status: 500,
		data: { error: 'The cloud token could not be deleted.' }
	});
	expect(JSON.stringify(failed)).not.toContain('provider-delete-secret');
});

test('cloud-init creation sends the exact body and never exposes script content', async () => {
	request.mockResolvedValueOnce({ uuid: 'script-created', script: 'response-script-secret' });
	await expect(
		createCloudInitScript(
			event(
				{
					name: 'Bootstrap node',
					script: '#cloud-config\npackages:\n  - docker',
					forged: 'ignored'
				},
				'/security/cloud-init-scripts/new'
			)
		)
	).rejects.toMatchObject({
		status: 303,
		location: '/security/cloud-init-scripts/script-created/general'
	});
	expect(request).toHaveBeenCalledWith('POST', '/cloud-init-scripts', {
		body: { name: 'Bootstrap node', script: '#cloud-config\npackages:\n  - docker' }
	});
});

test('cloud-init detail is write-only and blank replacement keeps the current script', async () => {
	request.mockResolvedValueOnce(script);
	const loaded = await loadCloudInitScript('script-1');
	expect(loaded.script).toMatchObject({ uuid: 'script-1', name: 'Docker bootstrap' });
	expect(JSON.stringify(loaded)).not.toContain('stored-cloud-init-secret');

	request.mockReset();
	request.mockResolvedValueOnce(script).mockResolvedValueOnce({ uuid: 'script-1' });
	await cloudInitActions.update(
		event(
			{ name: 'Updated bootstrap', script: '' },
			'/security/cloud-init-scripts/script-1/general',
			'script-1'
		)
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/cloud-init-scripts/script-1', {
		body: { name: 'Updated bootstrap' }
	});

	request.mockReset();
	request.mockResolvedValueOnce(script).mockResolvedValueOnce({ uuid: 'script-1' });
	await cloudInitActions.update(
		event(
			{ name: 'Updated bootstrap', script: '#!/bin/sh\necho updated' },
			'/security/cloud-init-scripts/script-1/general',
			'script-1'
		)
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/cloud-init-scripts/script-1', {
		body: { name: 'Updated bootstrap', script: '#!/bin/sh\necho updated' }
	});
});

test('cloud-init deletion requires an exact name or UUID', async () => {
	request.mockResolvedValueOnce(script);
	const wrong = await cloudInitActions.delete(
		event({ confirmation: 'wrong' }, '/security/cloud-init-scripts/script-1/danger', 'script-1')
	);
	expect(wrong).toMatchObject({ status: 400 });
	expect(request).toHaveBeenCalledTimes(1);

	request.mockReset();
	request.mockResolvedValueOnce(script).mockResolvedValueOnce({ message: 'deleted' });
	await expect(
		cloudInitActions.delete(
			event(
				{ confirmation: 'Docker bootstrap' },
				'/security/cloud-init-scripts/script-1/danger',
				'script-1'
			)
		)
	).rejects.toMatchObject({ status: 303, location: '/security/cloud-init-scripts' });
});
