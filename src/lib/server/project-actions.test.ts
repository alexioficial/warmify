import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));
import {
	createProject,
	createEnvironment,
	updateHierarchy,
	deleteHierarchy,
	hierarchySubmission,
	loadHierarchy
} from './project-actions';
import { CoolifyError } from './coolify-client';

function event(values: Record<string, string> = {}, environment?: string) {
	const body = new FormData();
	for (const [key, value] of Object.entries(values)) body.set(key, value);
	return {
		params: { uuid: 'project-1', ...(environment ? { environment } : {}) },
		locals: { user: { username: 'admin' } },
		setHeaders: vi.fn(),
		request: new Request('http://localhost/projects', { method: 'POST', body })
	} as unknown as RequestEvent;
}
const project = { uuid: 'project-1', name: 'Documentation', description: 'Docs', secret: 'hidden' };
const environment = { uuid: 'env-1', name: 'production', description: 'Live', password: 'hidden' };
beforeEach(() => {
	request.mockReset();
	invalidate.mockReset();
});

test('project creation redirects by returned UUID and never creates production a second time', async () => {
	request.mockResolvedValue({ uuid: 'project-2', secret: 'hidden' });
	await expect(
		createProject(event({ name: 'New project', description: 'A description', team_id: 'foreign' }))
	).rejects.toMatchObject({ status: 303, location: '/projects/project-2' });
	expect(request.mock.calls).toEqual([
		['POST', '/projects', { body: { name: 'New project', description: 'A description' } }]
	]);
	expect(invalidate).toHaveBeenCalledWith('projects');
});
test('environment creation only sends name and redirects into the parent-owned environment', async () => {
	request.mockResolvedValueOnce(project).mockResolvedValueOnce({ uuid: 'env-2' });
	await expect(
		createEnvironment(
			event({ name: 'staging', description: 'Unsupported', project_uuid: 'foreign' })
		)
	).rejects.toMatchObject({ status: 303, location: '/projects/project-1/environments/env-2' });
	expect(request).toHaveBeenLastCalledWith('POST', '/projects/project-1/environments', {
		body: { name: 'staging' }
	});
});
test.each(['', 'ab', '<script>', 'x'.repeat(256)])(
	'invalid hierarchy name is rejected before any API request: %s',
	async (name) => {
		const result = await createProject(event({ name, description: 'Keep this' }));
		expect(result).toMatchObject({
			status: 400,
			data: {
				values: { name, description: 'Keep this' },
				fieldErrors: { name: expect.any(String) }
			}
		});
		expect(request).not.toHaveBeenCalled();
	}
);
test('Unicode names and clearing descriptions follow the upstream field contract', () => {
	const form = new FormData();
	form.set('name', 'Área 日本語');
	form.set('description', '');
	expect(hierarchySubmission(form)).toMatchObject({
		body: { name: 'Área 日本語', description: null },
		fieldErrors: {}
	});
});
test('API field errors preserve only safe form fields', async () => {
	request.mockRejectedValue(
		new CoolifyError('Validation failed.', 422, {
			errors: { name: ['Choose another name'], token: ['do-not-echo'] }
		})
	);
	const result = await createProject(
		event({ name: 'Reserved name', description: 'Keep description', token: 'never-return' })
	);
	expect(result).toMatchObject({
		status: 422,
		data: {
			values: { name: 'Reserved name', description: 'Keep description' },
			fieldErrors: { name: 'Choose another name' }
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/do-not-echo|never-return/);
});
test('environment update is parent-scoped and ignores identity/cleanup claims', async () => {
	request
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce(environment)
		.mockResolvedValueOnce({ uuid: 'env-1' });
	await updateHierarchy(
		event(
			{ name: 'staging', description: 'Edited', uuid: 'foreign', delete_volumes: 'true' },
			'env-1'
		)
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/projects/project-1/environments/env-1', {
		body: { name: 'staging', description: 'Edited' }
	});
	expect(invalidate).toHaveBeenCalledWith('resources');
});
test('project update uses PATCH and allows clearing its description', async () => {
	request.mockResolvedValueOnce(project).mockResolvedValueOnce({ uuid: 'project-1' });
	await updateHierarchy(event({ name: 'Renamed project', description: '' }));
	expect(request).toHaveBeenLastCalledWith('PATCH', '/projects/project-1', {
		body: { name: 'Renamed project', description: null }
	});
});
test('duplicate environment rename preserves safe input and upstream conflict status', async () => {
	request
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce(environment)
		.mockRejectedValueOnce(new CoolifyError('Environment with this name already exists.', 409));
	expect(
		await updateHierarchy(event({ name: 'staging', description: 'Keep draft' }, 'env-1'))
	).toMatchObject({
		status: 409,
		data: { values: { name: 'staging', description: 'Keep draft' } }
	});
});
test('a substituted project identity cannot authorize deletion', async () => {
	request.mockResolvedValue({ ...project, uuid: 'other-project' });
	expect(await deleteHierarchy(event({ confirmation: 'Documentation' }))).toMatchObject({
		status: 404
	});
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
});
test('invalid description is rejected without issuing a mutation', async () => {
	expect(
		await createProject(event({ name: 'New project', description: 'x'.repeat(256) }))
	).toMatchObject({ status: 400, data: { fieldErrors: { description: expect.any(String) } } });
	expect(request).not.toHaveBeenCalled();
});
test('name-first environment lookup cannot substitute a different UUID for mutation', async () => {
	request
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce({ ...environment, uuid: 'different' });
	expect(await updateHierarchy(event({ name: 'New name' }, 'env-1'))).toMatchObject({
		status: 404
	});
	expect(request.mock.calls.some(([method]) => method === 'PATCH')).toBe(false);
});
test('settings context returns only presentation fields and complete breadcrumbs', async () => {
	request.mockResolvedValueOnce(project).mockResolvedValueOnce(environment);
	const result = await loadHierarchy(event({}, 'env-1'));
	expect(result.breadcrumbs).toEqual([
		{ label: 'Projects', href: '/projects' },
		{ label: 'Documentation', href: '/projects/project-1' },
		{ label: 'production', href: '/projects/project-1/environments/env-1' }
	]);
	expect(JSON.stringify(result)).not.toMatch(/hidden|password|secret/);
});
test.each(['', 'wrong'])(
	'deletion requires exact nonempty confirmation: %s',
	async (confirmation) => {
		request.mockResolvedValue(project);
		expect(await deleteHierarchy(event({ confirmation }))).toMatchObject({ status: 400 });
		expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
	}
);
test('nonempty project deletion refusal is preserved without deleting resources', async () => {
	request
		.mockResolvedValueOnce(project)
		.mockRejectedValueOnce(
			new CoolifyError('Project has resources, so it cannot be deleted.', 400)
		);
	expect(await deleteHierarchy(event({ confirmation: 'Documentation' }))).toMatchObject({
		status: 400,
		data: { error: expect.stringContaining('has resources') }
	});
	expect(request.mock.calls).toEqual([
		['GET', '/projects/project-1'],
		['DELETE', '/projects/project-1']
	]);
});
test('confirmed environment deletion targets its UUID and returns to its project', async () => {
	request
		.mockResolvedValueOnce(project)
		.mockResolvedValueOnce(environment)
		.mockResolvedValueOnce({});
	await expect(
		deleteHierarchy(event({ confirmation: 'production' }, 'env-1'))
	).rejects.toMatchObject({ status: 303, location: '/projects/project-1' });
	expect(request).toHaveBeenLastCalledWith('DELETE', '/projects/project-1/environments/env-1');
});
test('confirmed project deletion returns to projects', async () => {
	request.mockResolvedValueOnce(project).mockResolvedValueOnce({});
	await expect(deleteHierarchy(event({ confirmation: 'project-1' }))).rejects.toMatchObject({
		status: 303,
		location: '/projects'
	});
});
