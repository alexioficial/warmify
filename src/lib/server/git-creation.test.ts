import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { createGitResource, gitCreationSubmission, loadCreationGitDiscovery } from './git-creation';
import { CoolifyError } from './coolify-client';
function form(values: Record<string, string | undefined>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
	return data;
}
const base = {
	server_uuid: 's1',
	git_repository: 'https://github.com/team/repo',
	git_branch: 'main',
	build_pack: 'railpack'
};
function event(kind: string, values: Record<string, string | undefined>) {
	return {
		params: { uuid: 'p1', environment: 'e1', kind },
		locals: { user: { username: 'admin' } },
		url: new URL('http://localhost/create'),
		request: new Request('http://localhost/create', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form(values)
		})
	} as unknown as RequestEvent;
}
beforeEach(() => {
	request.mockReset().mockImplementation(async (method, path) => {
		if (method === 'POST') return { uuid: 'new-app', secret: 'response-secret' };
		if (path === '/projects/p1') return { uuid: 'p1' };
		if (path === '/projects/p1/e1') return { uuid: 'e1' };
		if (path === '/security/keys')
			return [{ uuid: 'key-1', name: 'Deploy', private_key: 'key-secret' }];
		if (path === '/github-apps')
			return [{ id: 7, uuid: 'gh-uuid', name: 'GitHub', client_secret: 'gh-secret' }];
		if (path === '/github-apps/7/repositories')
			return { repositories: [{ full_name: 'team/repo', name: 'repo', token: 'repo-secret' }] };
		if (path === '/github-apps/7/repositories/team/repo/branches')
			return { branches: [{ name: 'develop', secret: 'branch-secret' }] };
		throw new Error(`Unexpected ${path}`);
	});
});
test.each([
	['public-repository', '/applications/public', {}],
	['private-deploy-key', '/applications/private-deploy-key', { private_key_uuid: 'key-1' }],
	['github-app', '/applications/private-github-app', { github_app_uuid: 'gh-uuid' }]
])(
	'%s creation uses correct credentials and scoped parent UUIDs',
	async (kind, path, credential) => {
		await expect(
			createGitResource(
				event(kind, {
					...base,
					...credential,
					project_uuid: 'foreign',
					environment_name: 'wrong',
					environment_uuid: 'foreign',
					dockerfile: 'ignored'
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/applications/new-app/general' });
		expect(request).toHaveBeenCalledWith('POST', path, {
			body: { ...base, ...credential, project_uuid: 'p1', environment_uuid: 'e1' }
		});
	}
);
test.each(['railpack', 'nixpacks', 'static', 'dockerfile', 'dockercompose'])(
	'%s sends only conditional build fields',
	(pack) => {
		const result = gitCreationSubmission(
			form({
				...base,
				build_pack: pack,
				ports_exposes: '3000',
				domains: 'https://example.test',
				install_command: 'npm ci',
				build_command: 'npm run build',
				start_command: 'npm start',
				is_static: 'true',
				publish_directory: '/dist',
				dockerfile_location: '/Dockerfile',
				docker_compose_location: '/compose.yaml',
				docker_compose_custom_build_command: 'docker compose build',
				base_directory: '/app'
			}),
			'public-repository'
		);
		expect(result.fieldErrors).toEqual({});
		expect(result.body.base_directory).toBe('/app');
		if (pack === 'dockercompose') {
			expect(result.body).toHaveProperty('docker_compose_location', '/compose.yaml');
			expect(result.body).not.toHaveProperty('domains');
			expect(result.body).not.toHaveProperty('ports_exposes');
		} else expect(result.body.domains).toBe('https://example.test');
		if (pack === 'dockerfile') expect(result.body.dockerfile_location).toBe('/Dockerfile');
		else expect(result.body).not.toHaveProperty('dockerfile_location');
		if (['railpack', 'nixpacks'].includes(pack)) expect(result.body.is_static).toBe(true);
		else expect(result.body).not.toHaveProperty('is_static');
		if (['dockerfile', 'dockercompose'].includes(pack))
			expect(result.body).not.toHaveProperty('build_command');
		expect(JSON.stringify(result.values)).not.toMatch(
			/npm ci|npm run build|npm start|docker compose build/
		);
	}
);
test.each(['HEAD', 'feature//bad', 'bad..branch', '.hidden', 'name.lock', 'a b', 'a;touch'])(
	'rejects unsafe branch %s',
	(branch) => {
		expect(
			gitCreationSubmission(form({ ...base, git_branch: branch }), 'public-repository').fieldErrors
				.git_branch
		).toBeTruthy();
	}
);
test('embedded repository credentials are neither preserved nor sent', () => {
	const result = gitCreationSubmission(
		form({ ...base, git_repository: 'https://user:repo-secret@github.com/team/repo' }),
		'public-repository'
	);
	expect(result.fieldErrors.git_repository).toBeTruthy();
	expect(JSON.stringify(result.values)).not.toContain('repo-secret');
	expect(result.body).not.toHaveProperty('git_repository');
});
test('GitHub creation accepts owner/repository shorthand', () => {
	expect(
		gitCreationSubmission(
			form({ ...base, git_repository: 'team/repo', github_app_uuid: 'gh-uuid' }),
			'github-app'
		).fieldErrors
	).toEqual({});
});
test('invalid build pack and missing credentials prevent all requests', async () => {
	expect(
		await createGitResource(event('github-app', { ...base, build_pack: 'unknown' }))
	).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});
test('wrong parent or stale credentials cannot create an application', async () => {
	request.mockResolvedValue({ uuid: 'wrong' });
	expect(await createGitResource(event('public-repository', base))).toMatchObject({ status: 404 });
	expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
});
test('a stale deploy key is refused before POST', async () => {
	expect(
		await createGitResource(
			event('private-deploy-key', { ...base, private_key_uuid: 'foreign-key' })
		)
	).toMatchObject({ status: 404 });
	expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
});
test.each(['auth', 'origin'])(
	'Git creation refuses invalid %s before any API call',
	async (kind) => {
		const input = event('public-repository', base);
		if (kind === 'auth') input.locals.user = null;
		else input.request.headers.set('origin', 'https://foreign.test');
		expect(await createGitResource(input)).toMatchObject({ status: kind === 'auth' ? 401 : 403 });
		expect(request).not.toHaveBeenCalled();
	}
);
test('upstream snippets do not leak into validation responses, commands are write-only', async () => {
	request.mockImplementation(async (method, path) => {
		if (method === 'POST')
			throw new CoolifyError('command-secret fragment', 422, {
				errors: { build_command: ['command-secret'], name: ['response-secret'] }
			});
		return { uuid: path === '/projects/p1' ? 'p1' : 'e1' };
	});
	const result = await createGitResource(
		event('public-repository', { ...base, name: 'Keep', build_command: 'echo command-secret' })
	);
	expect(result).toMatchObject({
		status: 422,
		data: { values: { name: 'Keep' }, fieldErrors: { build_command: expect.any(String) } }
	});
	expect(JSON.stringify(result)).not.toMatch(/command-secret|response-secret/);
});
test('discovery uses numeric IDs, metadata-only results and repository membership', async () => {
	const result = await loadCreationGitDiscovery(
		new URL('http://localhost?github_app_id=7&repository=team/repo')
	);
	expect(result).toMatchObject({
		githubApps: [{ id: '7', uuid: 'gh-uuid', name: 'GitHub' }],
		repositories: [{ fullName: 'team/repo', name: 'repo' }],
		branches: [{ name: 'develop' }]
	});
	expect(JSON.stringify(result)).not.toMatch(/gh-secret|repo-secret|branch-secret/);
	expect(request).toHaveBeenCalledWith('GET', '/github-apps/7/repositories/team/repo/branches');
});
test('discovery rejects unknown App IDs and unlisted repositories', async () => {
	await loadCreationGitDiscovery(
		new URL('http://localhost?github_app_id=wrong&repository=team/repo')
	);
	expect(request).toHaveBeenCalledTimes(1);
	request.mockClear();
	await loadCreationGitDiscovery(
		new URL('http://localhost?github_app_id=7&repository=other/private')
	);
	expect(request.mock.calls.some(([, path]) => String(path).endsWith('/branches'))).toBe(false);
});
