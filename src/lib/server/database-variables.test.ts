import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { createResourceActions } from './resource-detail-page';
import { CoolifyError } from './coolify-client';
function event(values: Record<string, string>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(values)) body.set(key, value);
	return {
		params: { uuid: 'db-1' },
		locals: { user: { username: 'admin' } },
		request: new Request('http://localhost/database', { method: 'POST', body })
	} as unknown as RequestEvent;
}
const actions = createResourceActions('databases');
beforeEach(() => request.mockReset());
test('database variable update uses the parent-owned key and strips application-only flags', async () => {
	request
		.mockResolvedValueOnce([{ uuid: 'v1', key: 'MODE', value: 'stored-secret' }])
		.mockResolvedValueOnce({});
	await actions.updateVariable(
		event({
			env_uuid: 'v1',
			key: 'MODE',
			value: 'new-secret',
			is_literal: 'true',
			is_preview: 'true',
			is_buildtime: 'true',
			is_runtime: 'true'
		})
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/databases/db-1/envs', {
		body: {
			key: 'MODE',
			value: 'new-secret',
			is_literal: true,
			is_multiline: false,
			is_shown_once: false,
			comment: null
		}
	});
});
test.each([
	['other', 'MODE', 404],
	['v1', 'OTHER', 400]
])('update rejects mismatched variable identity %s/%s', async (uuid, key, status) => {
	request.mockResolvedValue([{ uuid: 'v1', key: 'MODE' }]);
	expect(
		await actions.updateVariable(
			event({ env_uuid: String(uuid), key: String(key), value: 'secret' })
		)
	).toMatchObject({ status });
	expect(request.mock.calls.some(([method]) => method === 'PATCH')).toBe(false);
});
test('upstream update errors do not expose submitted values', async () => {
	request
		.mockResolvedValueOnce([{ uuid: 'v1', key: 'MODE' }])
		.mockRejectedValueOnce(new CoolifyError('Rejected secret-value', 422));
	const result = await actions.updateVariable(
		event({ env_uuid: 'v1', key: 'MODE', value: 'secret-value', comment: 'Keep comment' })
	);
	expect(result).toMatchObject({
		status: 422,
		data: { values: { key: 'MODE', comment: 'Keep comment' } }
	});
	expect(JSON.stringify(result)).not.toContain('secret-value');
});
test.each([
	['foreign', 'MODE', 404],
	['v1', 'wrong', 400]
])(
	'delete requires parent ownership and exact confirmation %s',
	async (uuid, confirmation, status) => {
		request.mockResolvedValue([{ uuid: 'v1', key: 'MODE' }]);
		expect(
			await actions.deleteVariable(
				event({ env_uuid: String(uuid), confirmation: String(confirmation) })
			)
		).toMatchObject({ status });
		expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
	}
);
test('confirmed deletion addresses the exact database variable UUID', async () => {
	request.mockResolvedValueOnce([{ uuid: 'v1', key: 'MODE' }]).mockResolvedValueOnce({});
	await actions.deleteVariable(event({ env_uuid: 'v1', confirmation: 'MODE' }));
	expect(request).toHaveBeenLastCalledWith('DELETE', '/databases/db-1/envs/v1', undefined);
});
test('bulk upsert uses the database collection shape and does not return values', async () => {
	request.mockResolvedValue({});
	const result = await actions.bulkVariables(
		event({ production: 'MODE=secret-one\nOTHER=secret-two' })
	);
	expect(request).toHaveBeenCalledWith('PATCH', '/databases/db-1/envs/bulk', {
		body: {
			data: [
				{
					key: 'MODE',
					value: 'secret-one',
					is_literal: false,
					is_multiline: false,
					is_shown_once: false,
					comment: null
				},
				{
					key: 'OTHER',
					value: 'secret-two',
					is_literal: false,
					is_multiline: false,
					is_shown_once: false,
					comment: null
				}
			]
		}
	});
	expect(JSON.stringify(result)).not.toMatch(/secret-one|secret-two/);
});
test('database bulk input cannot silently overwrite production values with preview entries', async () => {
	expect(
		await actions.bulkVariables(event({ production: 'MODE=real', preview: 'MODE=preview' }))
	).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});
