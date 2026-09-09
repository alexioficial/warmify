import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { createTemplateResource, templateCreationSubmission } from './template-creation';
import { CoolifyError } from './coolify-client';
function form(values: Record<string, string>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values)) result.set(key, value);
	return result;
}
function event(values: Record<string, string>) {
	return {
		params: { uuid: 'p1', environment: 'e1', kind: 'service-template' },
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
	request
		.mockReset()
		.mockImplementation(async (method, path) =>
			method === 'POST'
				? { uuid: 'new-service', credentials: 'response-secret' }
				: { uuid: path === '/projects/p1' ? 'p1' : 'e1' }
		);
});
test('template payload omits generated defaults and isolates Compose/application fields', () => {
	const result = templateCreationSubmission(
		form({
			type: 'actualbudget',
			server_uuid: 's1',
			name: '',
			description: '',
			docker_compose_raw: 'secret-compose',
			git_repository: 'ignored',
			ports_exposes: '80',
			tags: 'personal, personal, budget',
			instant_deploy: 'false'
		})
	);
	expect(result.fieldErrors).toEqual({});
	expect(result.body).toEqual({
		type: 'actualbudget',
		server_uuid: 's1',
		tags: ['personal', 'budget'],
		instant_deploy: false
	});
	expect(JSON.stringify(result.values)).not.toMatch(/secret-compose|ignored/);
});
test.each(['', '../gitea', 'gitea;touch', 'bad template'])(
	'rejects invalid template type %s',
	(type) => {
		expect(
			templateCreationSubmission(form({ type, server_uuid: 's1' })).fieldErrors.type
		).toBeTruthy();
	}
);
test('server, tag length and name validation preserve a safe draft', async () => {
	const result = await createTemplateResource(
		event({ type: 'actualbudget', tags: 'x', name: 'a'.repeat(256) })
	);
	expect(result).toMatchObject({
		status: 400,
		data: {
			fieldErrors: {
				server_uuid: expect.any(String),
				tags: expect.any(String),
				name: expect.any(String)
			},
			values: { type: 'actualbudget' }
		}
	});
	expect(request).not.toHaveBeenCalled();
});
test('creation uses route hierarchy and a single supported POST, discards secrets and redirects', async () => {
	await expect(
		createTemplateResource(
			event({
				type: 'actualbudget',
				server_uuid: 's1',
				project_uuid: 'foreign',
				environment_uuid: 'foreign',
				environment_name: 'foreign'
			})
		)
	).rejects.toMatchObject({ status: 303, location: '/services/new-service/general' });
	expect(request).toHaveBeenCalledWith('POST', '/services', {
		body: { type: 'actualbudget', server_uuid: 's1', project_uuid: 'p1', environment_uuid: 'e1' }
	});
	expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
});
test.each(['auth', 'origin', 'parent'])(
	'invalid %s cannot create a template service',
	async (kind) => {
		const input = event({ type: 'actualbudget', server_uuid: 's1' });
		if (kind === 'auth') input.locals.user = null;
		if (kind === 'origin') input.request.headers.set('origin', 'https://other.test');
		if (kind === 'parent') request.mockResolvedValue({ uuid: 'wrong' });
		expect(await createTemplateResource(input)).toMatchObject({
			status: kind === 'auth' ? 401 : kind === 'origin' ? 403 : 404
		});
		expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
	}
);
test('legitimate rejected creation may show safe returned type names without probing or retrying', async () => {
	request.mockImplementation(async (method, path) => {
		if (method === 'POST')
			throw new CoolifyError('backend-secret', 404, {
				valid_service_types: [
					'actualbudget',
					'gitea-with-mysql',
					'../bad',
					{ token: 'hidden-secret' }
				]
			});
		return { uuid: path === '/projects/p1' ? 'p1' : 'e1' };
	});
	const result = await createTemplateResource(
		event({ type: 'missing', server_uuid: 's1', name: 'Keep' })
	);
	expect(result).toMatchObject({
		status: 404,
		data: {
			suggestedTypes: ['actualbudget', 'gitea-with-mysql'],
			values: { type: 'missing', name: 'Keep' }
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/backend-secret|hidden-secret/);
	expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
});
test('template parser errors and unknown field errors cannot leak response content', async () => {
	request.mockImplementation(async (method, path) => {
		if (method === 'POST')
			throw new CoolifyError('template-generated-secret', 422, {
				errors: { type: ['template-generated-secret'], docker_compose_raw: ['private-compose'] }
			});
		return { uuid: path === '/projects/p1' ? 'p1' : 'e1' };
	});
	const result = await createTemplateResource(event({ type: 'actualbudget', server_uuid: 's1' }));
	expect(result).toMatchObject({
		status: 422,
		data: { fieldErrors: { type: expect.any(String) } }
	});
	expect(JSON.stringify(result)).not.toMatch(/template-generated-secret|private-compose/);
});
