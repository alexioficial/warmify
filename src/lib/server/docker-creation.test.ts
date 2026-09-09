import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { createDockerResource, dockerCreationSubmission } from './docker-creation';
import { CoolifyError } from './coolify-client';
function form(values: Record<string, string | undefined>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values))
		if (value !== undefined) result.set(key, value);
	return result;
}
function event(kind: string, values: Record<string, string>) {
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
		if (method === 'POST') return { uuid: 'created', secret: 'response-secret' };
		return path === '/projects/p1'
			? { uuid: 'p1', name: 'Project' }
			: { uuid: 'e1', name: 'production' };
	});
});
test.each([
	[
		'dockerfile',
		'dockerfile',
		'FROM alpine\n# ñ\nRUN echo document-secret\n',
		'/applications/dockerfile',
		'applications'
	],
	[
		'docker-compose',
		'docker_compose_raw',
		'services:\n  web:\n    image: nginx\n# document-secret\n',
		'/services',
		'services'
	]
])(
	'%s encodes UTF-8 once, owns parent identity and redirects without response content',
	async (kind, field, document, path, group) => {
		await expect(
			createDockerResource(
				event(kind, {
					server_uuid: 's1',
					[field]: document,
					project_uuid: 'foreign',
					environment_uuid: 'foreign',
					environment_name: 'foreign',
					git_repository: 'ignored',
					instant_deploy: 'false'
				})
			)
		).rejects.toMatchObject({ status: 303, location: `/${group}/created/general` });
		expect(request).toHaveBeenCalledWith('POST', path, {
			body: {
				server_uuid: 's1',
				// Encode exactly the UTF-8 text returned by FormData, without a second transform.
				[field]: Buffer.from(document, 'utf8').toString('base64'),
				project_uuid: 'p1',
				environment_uuid: 'e1',
				instant_deploy: false
			}
		});
	}
);
test('image references preserve embedded tags and digests without appending latest', () => {
	for (const image of [
		'nginx:stable',
		`ghcr.io/team/app@sha256:${'a'.repeat(64)}`,
		'registry.test:5000/team/app'
	]) {
		const result = dockerCreationSubmission(
			form({ server_uuid: 's1', docker_registry_image_name: image, docker_registry_image_tag: '' }),
			'docker-image'
		);
		expect(result.fieldErrors).toEqual({});
		expect(result.body).toEqual({ server_uuid: 's1', docker_registry_image_name: image });
	}
});
test('separate digest is encoded in the image reference, never an unsupported API field', () => {
	const digest = 'b'.repeat(64);
	const result = dockerCreationSubmission(
		form({ server_uuid: 's1', docker_registry_image_name: 'nginx', digest }),
		'docker-image'
	);
	expect(result.fieldErrors).toEqual({});
	expect(result.body).toEqual({
		server_uuid: 's1',
		docker_registry_image_name: `nginx@sha256:${digest}`
	});
});
test.each([
	{ docker_registry_image_name: 'nginx:stable', docker_registry_image_tag: 'latest' },
	{ docker_registry_image_name: 'nginx', digest: 'not-a-digest' },
	{
		docker_registry_image_name: 'nginx',
		digest: 'a'.repeat(64),
		docker_registry_image_tag: 'latest'
	},
	{ docker_registry_image_name: 'https://registry.test/nginx' },
	{ docker_registry_image_name: 'nginx', docker_registry_image_tag: 'bad tag' }
])('rejects ambiguous or invalid Docker image selection %j', (input) => {
	expect(
		Object.keys(
			dockerCreationSubmission(form({ server_uuid: 's1', ...input }), 'docker-image').fieldErrors
		).length
	).toBeGreaterThan(0);
});
test.each(['0', '65536', '80,abc', '1.5'])('rejects invalid exposed ports %s', (ports) => {
	expect(
		dockerCreationSubmission(
			form({ server_uuid: 's1', docker_registry_image_name: 'nginx', ports_exposes: ports }),
			'docker-image'
		).fieldErrors.ports_exposes
	).toBeTruthy();
});
test('blank documents and missing servers fail without a request; defaults are omitted', async () => {
	const result = await createDockerResource(event('dockerfile', { dockerfile: '  ', name: '' }));
	expect(result).toMatchObject({
		status: 400,
		data: { fieldErrors: { server_uuid: expect.any(String), dockerfile: expect.any(String) } }
	});
	expect(request).not.toHaveBeenCalled();
});
test('unsupported kinds cannot fall through to service creation', async () => {
	expect(await createDockerResource(event('unknown', { server_uuid: 's1' }))).toMatchObject({
		status: 404
	});
	expect(request).not.toHaveBeenCalled();
});
test('parent mismatch prevents creation', async () => {
	request.mockResolvedValue({ uuid: 'other' });
	expect(
		await createDockerResource(
			event('docker-image', { server_uuid: 's1', docker_registry_image_name: 'nginx' })
		)
	).toMatchObject({ status: 404 });
	expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
});
test.each(['auth', 'origin'])('%s failure prevents API access', async (kind) => {
	const input = event('docker-image', { server_uuid: 's1', docker_registry_image_name: 'nginx' });
	if (kind === 'auth') input.locals.user = null;
	else input.request.headers.set('origin', 'https://other.test');
	expect(await createDockerResource(input)).toMatchObject({ status: kind === 'auth' ? 401 : 403 });
	expect(request).not.toHaveBeenCalled();
});
test('API failures cannot serialize document fragments, encoded values or response secrets', async () => {
	request.mockImplementation(async (method, path) => {
		if (method === 'POST')
			throw new CoolifyError('document-secret fragment', 422, {
				errors: { dockerfile: ['document-secret'], name: ['response-secret'] }
			});
		return { uuid: path === '/projects/p1' ? 'p1' : 'e1' };
	});
	const result = await createDockerResource(
		event('dockerfile', {
			server_uuid: 's1',
			name: 'Keep',
			dockerfile: 'FROM alpine\n# document-secret',
			instant_deploy: 'false'
		})
	);
	expect(result).toMatchObject({
		status: 422,
		data: {
			values: { name: 'Keep', instant_deploy: false },
			fieldErrors: { dockerfile: expect.any(String) }
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/document-secret|response-secret|FROM alpine|RlJPT/);
});
test('response without a UUID returns to the environment without retrying creation', async () => {
	request.mockImplementation(async (method, path) =>
		method === 'POST' ? { message: 'Skipped' } : { uuid: path === '/projects/p1' ? 'p1' : 'e1' }
	);
	await expect(
		createDockerResource(
			event('docker-image', { server_uuid: 's1', docker_registry_image_name: 'nginx' })
		)
	).rejects.toMatchObject({ status: 303, location: '/projects/p1/environments/e1' });
	expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
});
