import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import {
	sharedVariableRows,
	sharedVariableSubmission,
	sharedVariableActions,
	revealSharedVariable,
	loadSharedVariables
} from './shared-variables';
import { CoolifyError } from './coolify-client';
const project = { uuid: 'project-1', name: 'Project', description: '' };
const environment = { uuid: 'env-1', name: 'production' };
const variable = {
	id: 7,
	key: 'API_KEY',
	value: 'stored-secret',
	comment: 'Original',
	is_literal: false,
	is_multiline: false,
	is_shown_once: false
};
function event(
	values: Record<string, string>,
	env = false,
	json = false,
	origin = 'http://localhost',
	user = true
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'project-1', ...(env ? { environment: 'env-1' } : {}) },
		url: new URL('http://localhost/projects'),
		locals: { user: user ? { username: 'admin' } : null },
		setHeaders: vi.fn(),
		request: new Request('http://localhost/projects', {
			method: 'POST',
			headers: { origin, ...(json ? { 'content-type': 'application/json' } : {}) },
			body: json ? JSON.stringify(values) : form
		})
	} as unknown as RequestEvent;
}
function parent(env = false) {
	request.mockResolvedValueOnce(project);
	if (env) request.mockResolvedValueOnce(environment);
}
beforeEach(() => request.mockReset());
test('shared list allowlists metadata, uses numeric IDs and discards unknown nested secrets', () => {
	expect(
		sharedVariableRows([
			{ ...variable, uuid: 'wrong-id', nested: { token: 'nested-secret' } },
			{ key: 'MISSING_ID' }
		])
	).toEqual([
		{
			id: '7',
			key: 'API_KEY',
			comment: 'Original',
			is_literal: false,
			is_multiline: false,
			is_shown_once: false
		}
	]);
});
test.each([false, true])(
	'shared load preserves hierarchy but never serializes values (environment=%s)',
	async (env) => {
		parent(env);
		request.mockResolvedValueOnce([variable]);
		const result = await loadSharedVariables(event({}, env));
		expect(JSON.stringify(result)).not.toContain('stored-secret');
		expect(result.breadcrumbs.at(-1)?.href).toBe(
			env
				? '/projects/project-1/environments/env-1/shared-variables'
				: '/projects/project-1/shared-variables'
		);
	}
);
test.each([false, true])(
	'create sends only shared-variable fields to the correct scope (environment=%s)',
	async (env) => {
		parent(env);
		request.mockResolvedValueOnce({ id: 8 });
		const result = await sharedVariableActions.createVariable(
			event(
				{
					key: ' New.Key ',
					value: 'new-secret',
					is_preview: 'true',
					is_runtime: 'true',
					project_id: 'foreign'
				},
				env
			)
		);
		expect(request).toHaveBeenLastCalledWith(
			'POST',
			env ? '/projects/project-1/environments/env-1/envs' : '/projects/project-1/envs',
			{
				body: {
					key: 'New.Key',
					value: 'new-secret',
					comment: null,
					is_literal: false,
					is_multiline: false,
					is_shown_once: false
				}
			}
		);
		expect(JSON.stringify(result)).not.toContain('new-secret');
	}
);
test('rename or comment edit keeps the stored value unless replacement is explicitly selected', async () => {
	parent();
	request
		.mockResolvedValueOnce([variable])
		.mockResolvedValueOnce({ ...variable, value: 'response-secret' });
	const result = await sharedVariableActions.updateVariable(
		event({ id: '7', key: 'RENAMED', comment: 'Updated', value: 'ignored-secret' })
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/projects/project-1/envs/7', {
		body: {
			key: 'RENAMED',
			comment: 'Updated',
			is_literal: false,
			is_multiline: false,
			is_shown_once: false
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/ignored-secret|response-secret|stored-secret/);
});
test.each([
	['replace', 'new-secret', 'new-secret'],
	['replace', '', ''],
	['clear', 'ignored-secret', null]
])('explicit %s has the intended value semantics', (mode, input, expected) => {
	const form = new FormData();
	form.set('key', 'KEY');
	form.set('value', String(input));
	form.set('value_mode', String(mode));
	const submission = sharedVariableSubmission(form, true);
	expect(submission.body?.value).toBe(expected);
	expect(JSON.stringify(submission.values)).not.toMatch(/secret/);
});
test.each(['', '0', 'env-7', '../8'])(
	'update rejects invalid numeric identity %s without API calls',
	async (id) => {
		expect(await sharedVariableActions.updateVariable(event({ id, key: 'KEY' }))).toMatchObject({
			status: 400
		});
		expect(request).not.toHaveBeenCalled();
	}
);
test('a foreign variable ID cannot be edited inside another scope', async () => {
	parent(true);
	request.mockResolvedValueOnce([variable]);
	expect(
		await sharedVariableActions.updateVariable(event({ id: '8', key: 'KEY' }, true))
	).toMatchObject({ status: 404 });
	expect(request.mock.calls.some(([method]) => method === 'PATCH')).toBe(false);
});
test('delete checks the loaded key rather than a client key claim', async () => {
	parent();
	request.mockResolvedValueOnce([variable]);
	expect(
		await sharedVariableActions.deleteVariable(
			event({ id: '7', key: 'fake', confirmation: 'fake' })
		)
	).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
});
test('confirmed delete uses parent scope and numeric ID', async () => {
	parent(true);
	request.mockResolvedValueOnce([variable]).mockResolvedValueOnce({});
	await sharedVariableActions.deleteVariable(event({ id: '7', confirmation: 'API_KEY' }, true));
	expect(request).toHaveBeenLastCalledWith(
		'DELETE',
		'/projects/project-1/environments/env-1/envs/7'
	);
});
test('upstream validation errors scrub stored and submitted secrets and preserve safe drafts', async () => {
	parent();
	request.mockResolvedValueOnce([variable]).mockRejectedValueOnce(
		new CoolifyError('Rejected stored-secret and new-secret', 422, {
			errors: { value: ['new-secret'], key: ['stored-secret'] }
		})
	);
	const result = await sharedVariableActions.updateVariable(
		event({ id: '7', key: 'API_KEY', comment: 'Keep', value_mode: 'replace', value: 'new-secret' })
	);
	expect(result).toMatchObject({
		status: 422,
		data: { values: { key: 'API_KEY', comment: 'Keep' } }
	});
	expect(JSON.stringify(result)).not.toMatch(/stored-secret|new-secret/);
});
test.each([
	[false, 'http://localhost', 401],
	[true, 'https://other.test', 403]
])(
	'reveal rejects unauthorized origin/session before any API request',
	async (user, origin, status) => {
		const result = await revealSharedVariable(
			event({ id: '7' }, false, true, String(origin), Boolean(user))
		);
		expect(result.status).toBe(status);
		expect(request).not.toHaveBeenCalled();
		expect(result.headers.get('cache-control')).toBe('no-store');
	}
);
test('reveal returns only the selected value with no-store', async () => {
	parent();
	request.mockResolvedValueOnce([variable, { ...variable, id: 8, value: 'other-secret' }]);
	const result = await revealSharedVariable(event({ id: '7' }, false, true));
	expect(result.headers.get('cache-control')).toBe('no-store');
	expect(await result.json()).toEqual({ value: 'stored-secret' });
});
test.each([
	{ ...variable, is_shown_once: true },
	{ id: 7, key: 'API_KEY' }
])('shown-once and absent sensitive permission cannot reveal an invented value', async (entry) => {
	parent();
	request.mockResolvedValueOnce([entry]);
	const result = await revealSharedVariable(event({ id: '7' }, false, true));
	expect(result.status).toBe(403);
	expect(await result.text()).not.toContain('stored-secret');
});
test('reveal refuses a mismatched parent environment UUID', async () => {
	request.mockResolvedValueOnce(project).mockResolvedValueOnce({ ...environment, uuid: 'foreign' });
	const result = await revealSharedVariable(event({ id: '7' }, true, true));
	expect(result.status).toBe(404);
	expect(request).toHaveBeenCalledTimes(2);
});
