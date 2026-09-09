import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { createDatabaseConfigurationActions } from './database-pages';
import { createStorageActions } from './application-storage-actions';

function event(values: Record<string, string>): RequestEvent {
	const body = new FormData();
	for (const [key, value] of Object.entries(values)) body.set(key, value);
	return {
		params: { uuid: 'db-1' },
		locals: { user: { username: 'admin' } },
		request: new Request('http://localhost/databases/db-1/general', { method: 'POST', body })
	} as unknown as RequestEvent;
}
beforeEach(() => request.mockReset());
describe('database server action boundaries', () => {
	test('uses the current engine and physical section, not hidden form claims', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-redis' })
			.mockResolvedValueOnce({ uuid: 'db-1' });
		await createDatabaseConfigurationActions('credentials').save(
			event({
				_section: 'general',
				type: 'standalone-postgresql',
				name: 'Injected',
				postgres_password: 'wrong',
				redis_password: 'right'
			})
		);
		expect(request).toHaveBeenLastCalledWith('PATCH', '/databases/db-1', {
			body: { redis_password: 'right' }
		});
	});
	test('does not write when the current engine cannot authorize the requested fields', async () => {
		request.mockResolvedValue({ type: 'unknown' });
		expect(
			await createDatabaseConfigurationActions('credentials').save(
				event({ redis_password: 'secret' })
			)
		).toMatchObject({ status: 400 });
		expect(request.mock.calls.filter(([method]) => method === 'PATCH')).toHaveLength(0);
	});
	test('does not serialize submitted passwords from upstream validation errors', async () => {
		request.mockResolvedValueOnce({ type: 'standalone-postgresql' }).mockRejectedValueOnce(
			new CoolifyError('Invalid submitted-secret', 422, {
				errors: { postgres_password: ['Rejected submitted-secret'] }
			})
		);
		const result = await createDatabaseConfigurationActions('credentials').save(
			event({ postgres_password: 'submitted-secret', postgres_user: 'admin' })
		);
		expect(result).toMatchObject({ status: 422, data: { values: { postgres_user: 'admin' } } });
		expect(JSON.stringify(result)).not.toContain('submitted-secret');
	});
	test('database volumes do not inherit service container identifiers', async () => {
		request.mockResolvedValue({ uuid: 'storage-1' });
		await createStorageActions('databases').createStorage(
			event({
				kind: 'persistent',
				name: 'data',
				mount_path: '/data',
				resource_uuid: 'injected-container'
			})
		);
		expect(request).toHaveBeenCalledWith('POST', '/databases/db-1/storages', {
			body: { type: 'persistent', name: 'data', mount_path: '/data' }
		});
	});
});
