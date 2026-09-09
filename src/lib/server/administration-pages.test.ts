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
	createPrivateKey,
	loadPrivateKey,
	loadPrivateKeyIndex,
	loadTeamDetail,
	loadTeamIndex,
	privateKeyActions,
	revealPrivateKey
} from './administration-pages';

const key = {
	uuid: 'key-1',
	name: 'Production SSH',
	description: 'Main server key',
	private_key: 'stored-private-secret',
	public_key: 'ssh-ed25519 public-material',
	fingerprint: 'SHA256:fingerprint',
	is_git_related: false
};
const team = { id: 1, name: 'Root Team', description: 'Primary', personal_team: false };
const member = {
	id: 7,
	name: 'Admin',
	email: 'admin@example.test',
	password: 'password-secret',
	pivot: { role: 'owner' },
	email_change_code: 'code-secret'
};

function event(values: Record<string, string>, path: string, uuid = '', json = false, user = true) {
	const form = new FormData();
	for (const [name, value] of Object.entries(values)) form.set(name, value);
	return {
		params: { uuid },
		locals: { user: user ? { username: 'admin' } : null },
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: {
				origin: 'http://localhost',
				...(json ? { 'content-type': 'application/json' } : {})
			},
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	collectionForPage.mockReset();
	invalidate.mockReset();
});

test('private key index/detail never serialize private key material', async () => {
	collectionForPage.mockResolvedValueOnce([key]);
	const index = await loadPrivateKeyIndex(vi.fn());
	request.mockResolvedValueOnce(key);
	const detail = await loadPrivateKey('key-1');
	expect(index.keys[0]).toMatchObject({ uuid: 'key-1', name: 'Production SSH' });
	expect(detail.key).toMatchObject({ uuid: 'key-1', fingerprint: 'SHA256:fingerprint' });
	expect(JSON.stringify({ index, detail })).not.toContain('stored-private-secret');
});

test('private key creation sends an exact allowlist and clears secret responses', async () => {
	request.mockResolvedValueOnce({ uuid: 'key-created', private_key: 'response-secret' });
	await expect(
		createPrivateKey(
			event(
				{
					name: 'Deploy key',
					description: 'Git access',
					private_key: 'submitted-secret',
					forged: 'ignored'
				},
				'/security/keys/new'
			)
		)
	).rejects.toMatchObject({ status: 303, location: '/security/keys/key-created' });
	expect(request).toHaveBeenCalledWith('POST', '/security/keys', {
		body: { name: 'Deploy key', description: 'Git access', private_key: 'submitted-secret' }
	});
});

test('metadata update reuses current material only server-side and rotation uses the replacement', async () => {
	request
		.mockResolvedValueOnce(key)
		.mockResolvedValueOnce({ uuid: 'key-1', private_key: 'response-secret' });
	const metadata = await privateKeyActions.update(
		event({ name: 'Renamed', description: 'Updated' }, '/security/keys/key-1', 'key-1')
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/security/keys/key-1', {
		body: { name: 'Renamed', description: 'Updated', private_key: 'stored-private-secret' }
	});
	expect(JSON.stringify(metadata)).not.toMatch(/stored-private-secret|response-secret/);

	request.mockReset();
	request.mockResolvedValueOnce(key).mockResolvedValueOnce({ uuid: 'key-1' });
	await privateKeyActions.update(
		event(
			{ name: 'Rotated', description: 'Updated', replacement_private_key: 'replacement-secret' },
			'/security/keys/key-1',
			'key-1'
		)
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/security/keys/key-1', {
		body: { name: 'Rotated', description: 'Updated', private_key: 'replacement-secret' }
	});
});

test('reveal is same-origin, no-store and returns only the selected private material', async () => {
	request.mockResolvedValueOnce(key);
	const response = await revealPrivateKey(event({}, '/security/keys/key-1/reveal', 'key-1', true));
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toEqual({ privateKey: 'stored-private-secret' });

	request.mockReset();
	const unauthenticated = await revealPrivateKey(
		event({}, '/security/keys/key-1/reveal', 'key-1', true, false)
	);
	expect(unauthenticated.status).toBe(401);
	expect(request).not.toHaveBeenCalled();
});

test('delete requires fresh exact identity and hides upstream in-use details', async () => {
	request.mockResolvedValueOnce(key);
	expect(
		await privateKeyActions.delete(
			event({ confirmation: 'wrong' }, '/security/keys/key-1', 'key-1')
		)
	).toMatchObject({ status: 400 });
	expect(request).toHaveBeenCalledTimes(1);

	request.mockReset();
	request
		.mockResolvedValueOnce(key)
		.mockRejectedValueOnce(new CoolifyError('server identity and private details', 422));
	const failed = await privateKeyActions.delete(
		event({ confirmation: 'Production SSH' }, '/security/keys/key-1', 'key-1')
	);
	expect(failed).toMatchObject({
		status: 422,
		data: { error: 'This private key is still used by a server, application, or Git integration.' }
	});
	expect(JSON.stringify(failed)).not.toContain('private details');
});

test('team pages expose only the token-bound team and projected member fields', async () => {
	collectionForPage.mockResolvedValueOnce([team]);
	const index = await loadTeamIndex(vi.fn());
	request.mockResolvedValueOnce(team).mockResolvedValueOnce([member]);
	const detail = await loadTeamDetail('1');
	expect(index.teams).toEqual([expect.objectContaining({ id: '1', name: 'Root Team' })]);
	expect(detail.members).toEqual([
		expect.objectContaining({ id: '7', name: 'Admin', email: 'admin@example.test' })
	]);
	expect(JSON.stringify(detail)).not.toMatch(/password-secret|code-secret|pivot/);
	expect(request).toHaveBeenNthCalledWith(1, 'GET', '/teams/1');
	expect(request).toHaveBeenNthCalledWith(2, 'GET', '/teams/1/members');
});
