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
	createSourceAction,
	loadGithubRepositories,
	loadSource,
	loadSourcesIndex,
	sourceActions,
	sourceView
} from './source-pages';

const github = {
	id: 7,
	uuid: 'github-app-1',
	name: 'widube',
	organization: 'widube',
	api_url: 'https://api.github.com',
	html_url: 'https://github.com',
	custom_user: 'git',
	custom_port: 22,
	app_id: 101,
	installation_id: 202,
	client_id: 'client-id',
	private_key_id: 3,
	is_system_wide: false,
	is_public: false,
	team_id: 1,
	client_secret: 'github-client-secret',
	webhook_secret: 'github-webhook-secret'
};
const gitlab = {
	id: 8,
	uuid: 'gitlab-app-1',
	name: 'internal-gitlab',
	api_url: 'https://gitlab.example.com/api/v4',
	html_url: 'https://gitlab.example.com',
	custom_user: 'git',
	custom_port: 22,
	client_id: 'gitlab-client',
	group_name: 'platform',
	redirect_uri: 'https://coolify.example.com/webhooks/source/gitlab/redirect',
	is_system_wide: false,
	is_public: false,
	team_id: 1,
	client_secret: 'gitlab-client-secret',
	webhook_token: 'gitlab-webhook-secret',
	access_token: 'gitlab-access-secret'
};
const keys = [
	{
		id: 3,
		uuid: 'key-1',
		name: 'GitHub RSA key',
		description: 'Provider access',
		private_key: 'private-key-secret'
	}
];

function event(
	values: Record<string, string>,
	path: string,
	params: Record<string, string> = { provider: 'github', id: '7' }
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params,
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

test('source presenters and cached index expose only explicit non-secret fields', async () => {
	const githubView = sourceView(github, 'github');
	const gitlabView = sourceView(gitlab, 'gitlab');
	expect(githubView).toMatchObject({ id: 7, uuid: 'github-app-1', provider: 'github' });
	expect(gitlabView).toMatchObject({ id: 8, uuid: 'gitlab-app-1', provider: 'gitlab' });
	expect(JSON.stringify([githubView, gitlabView])).not.toMatch(
		/client-secret|webhook-secret|access-secret/
	);

	collectionForPage.mockResolvedValue([
		{ ...github, provider: 'github' },
		{ ...gitlab, provider: 'gitlab' }
	]);
	const result = await loadSourcesIndex(vi.fn());
	expect(result.sources.map((source) => source.provider)).toEqual(['github', 'gitlab']);
	expect(JSON.stringify(result)).not.toContain('github-client-secret');
});

test('source detail establishes current-team ownership and projects private-key choices', async () => {
	request
		.mockResolvedValueOnce({ id: 1, name: 'Root Team' })
		.mockResolvedValueOnce([github])
		.mockResolvedValueOnce(keys);
	const result = await loadSource('github', '7');
	expect(result.source.owned).toBe(true);
	expect(result.keys).toEqual([
		{ id: 3, uuid: 'key-1', name: 'GitHub RSA key', description: 'Provider access' }
	]);
	expect(JSON.stringify(result)).not.toMatch(/github-client-secret|private-key-secret/);
});

test('GitHub creation checks key membership and sends one exact allowlist', async () => {
	request.mockResolvedValueOnce(keys).mockResolvedValueOnce({ ...github, id: 9, uuid: 'created' });
	await expect(
		createSourceAction(
			event(
				{
					name: 'GitHub source',
					organization: '@widube',
					html_url: 'https://github.com/',
					api_url: 'https://api.github.com',
					custom_user: 'git',
					custom_port: '22',
					app_id: '101',
					installation_id: '202',
					client_id: 'client-id',
					client_secret: 'submitted-client-secret',
					webhook_secret: 'submitted-webhook-secret',
					private_key_uuid: 'key-1',
					is_system_wide: 'false',
					forged: 'ignored'
				},
				'/sources/new/github',
				{ provider: 'github' }
			),
			'github'
		)
	).rejects.toMatchObject({ status: 303, location: '/sources/github/9/general' });
	expect(request.mock.calls).toEqual([
		['GET', '/security/keys'],
		[
			'POST',
			'/github-apps',
			{
				body: expect.objectContaining({
					name: 'GitHub source',
					organization: 'widube',
					html_url: 'https://github.com',
					client_secret: 'submitted-client-secret',
					webhook_secret: 'submitted-webhook-secret',
					private_key_uuid: 'key-1'
				})
			}
		]
	]);
	expect(request.mock.calls[1][2].body).not.toHaveProperty('forged');
});

test('GitLab updates use keep-or-replace secret inputs and never return submitted secrets', async () => {
	request
		.mockResolvedValueOnce({ id: 1 })
		.mockResolvedValueOnce([gitlab])
		.mockResolvedValueOnce(keys)
		.mockResolvedValueOnce({ message: 'updated', data: gitlab });
	const result = await sourceActions.update(
		event(
			{
				name: 'Renamed GitLab',
				html_url: 'https://gitlab.example.com',
				api_url: 'https://gitlab.example.com/api/v4',
				custom_user: 'git',
				custom_port: '22',
				group_name: 'platform',
				client_id: 'gitlab-client',
				client_secret: 'replacement-secret',
				webhook_token: '',
				redirect_uri: 'https://coolify.example.com/webhooks/source/gitlab/redirect'
			},
			'/sources/gitlab/8/general',
			{ provider: 'gitlab', id: '8' }
		)
	);
	expect(result).toMatchObject({ message: 'GitLab App settings saved.' });
	expect(request).toHaveBeenLastCalledWith('PATCH', '/gitlab-apps/8', {
		body: expect.objectContaining({ client_secret: 'replacement-secret' })
	});
	expect(request.mock.calls.at(-1)?.[2].body).not.toHaveProperty('webhook_token');
	expect(JSON.stringify(result)).not.toContain('replacement-secret');
});

test('GitHub repository and branch discovery rechecks ownership and repository membership', async () => {
	request
		.mockResolvedValueOnce({ id: 1 })
		.mockResolvedValueOnce([github])
		.mockResolvedValueOnce({
			repositories: [{ name: 'api', full_name: 'widube/api', private: true, secret: 'repo-secret' }]
		});
	const loaded = await loadGithubRepositories('7');
	expect(loaded.repositories).toEqual([
		{ name: 'api', fullName: 'widube/api', isPrivate: true, defaultBranch: '' }
	]);
	expect(JSON.stringify(loaded)).not.toContain('repo-secret');

	request.mockReset();
	request
		.mockResolvedValueOnce({ id: 1 })
		.mockResolvedValueOnce([github])
		.mockResolvedValueOnce({ repositories: [{ name: 'api', full_name: 'widube/api' }] })
		.mockResolvedValueOnce({ branches: [{ name: 'main' }, { name: 'develop', secret: 'x' }] });
	const branches = await sourceActions.loadBranches(
		event({ repository: 'widube/api' }, '/sources/github/7/repositories', {
			provider: 'github',
			id: '7'
		})
	);
	expect(branches).toEqual({ repository: 'widube/api', branches: ['develop', 'main'] });
	expect(request).toHaveBeenLastCalledWith(
		'GET',
		'/github-apps/7/repositories/widube/api/branches'
	);
});

test('source deletion maps in-use conflicts without leaking upstream text', async () => {
	request
		.mockResolvedValueOnce({ id: 1 })
		.mockResolvedValueOnce([github])
		.mockResolvedValueOnce(keys)
		.mockRejectedValueOnce(new CoolifyError('used by secret application', 409));
	const result = await sourceActions.delete(
		event({ confirmation: 'widube' }, '/sources/github/7/danger', { provider: 'github', id: '7' })
	);
	expect(result).toMatchObject({
		status: 409,
		data: { error: 'Move every application away from this source before deleting it.' }
	});
	expect(JSON.stringify(result)).not.toContain('secret application');
});
