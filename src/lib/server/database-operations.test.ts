import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));
import {
	createDatabaseOperationActions,
	createDatabaseTagActions,
	createDatabaseDangerActions
} from './database-operations';
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
beforeEach(() => {
	request.mockReset();
	invalidate.mockReset();
});
test('tag creation deduplicates names and sends only the database tag contract', async () => {
	request.mockResolvedValue([]);
	await createDatabaseTagActions().addTags(
		event({ tag_names: 'production, production\nimportant', password: 'never-send' })
	);
	expect(request).toHaveBeenCalledWith('POST', '/databases/db-1/tags', {
		body: { tag_names: ['production', 'important'] }
	});
	expect(invalidate).toHaveBeenCalledWith('databases');
});
test('invalid tags retain safe input without calling Coolify', async () => {
	expect(
		await createDatabaseTagActions().addTags(event({ tag_names: 'x', token: 'secret' }))
	).toMatchObject({ status: 400, data: { tagNames: 'x' } });
	expect(request).not.toHaveBeenCalled();
});
test.each(['missing', 'wrong-confirmation'])(
	'tag removal rejects %s before DELETE',
	async (kind) => {
		request.mockResolvedValue([{ uuid: 'tag-1', name: 'production' }]);
		expect(
			await createDatabaseTagActions().deleteTag(
				event({ tag_uuid: kind === 'missing' ? 'other' : 'tag-1', confirmation: 'wrong' })
			)
		).toMatchObject({ status: kind === 'missing' ? 404 : 400 });
		expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
	}
);
test('confirmed tag removal uses the parent database path', async () => {
	request.mockResolvedValueOnce([{ uuid: 'tag-1', name: 'production' }]).mockResolvedValue({});
	await createDatabaseTagActions().deleteTag(
		event({ tag_uuid: 'tag-1', confirmation: 'production' })
	);
	expect(request).toHaveBeenCalledWith('DELETE', '/databases/db-1/tags/tag-1', {});
});
test.each(['clone', 'move', 'migrate'] as const)(
	'%s cannot bypass typed confirmation',
	async (operation) => {
		request.mockResolvedValue({ name: 'SQL data' });
		expect(
			await createDatabaseOperationActions()[`${operation}Database`](
				event({ confirmation: 'confirm', destination_uuid: 'dest-1', environment_uuid: 'env-1' })
			)
		).toMatchObject({ status: 400 });
		expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
	}
);
test('clone emits only clone fields and redirects to the new physical detail', async () => {
	request
		.mockResolvedValueOnce({ name: 'SQL data' })
		.mockResolvedValueOnce({ uuid: 'copy-1', postgres_password: 'never-return' });
	await expect(
		createDatabaseOperationActions().cloneDatabase(
			event({
				confirmation: 'clone SQL data',
				destination_uuid: 'dest-1',
				name: 'Copy',
				environment_uuid: 'ignored',
				clone_volumes: 'true'
			})
		)
	).rejects.toMatchObject({ status: 303, location: '/databases/copy-1/general' });
	expect(request).toHaveBeenCalledWith('POST', '/databases/db-1/clone', {
		body: { destination_uuid: 'dest-1', name: 'Copy', clone_volumes: true }
	});
});
test('move sends only environment identity and refreshes hierarchy after success', async () => {
	request.mockResolvedValueOnce({ name: 'SQL data' }).mockResolvedValueOnce({});
	await expect(
		createDatabaseOperationActions().moveDatabase(
			event({
				confirmation: 'move SQL data',
				environment_uuid: 'env-2',
				destination_uuid: 'ignored'
			})
		)
	).rejects.toMatchObject({ location: '/databases/db-1/general' });
	expect(request).toHaveBeenCalledWith('POST', '/databases/db-1/move', {
		body: { environment_uuid: 'env-2' }
	});
	expect(invalidate).toHaveBeenCalledWith('projects');
});
test('migration preserves opt-out of transferring volumes', async () => {
	request.mockResolvedValueOnce({ name: 'SQL data' }).mockResolvedValueOnce({});
	await createDatabaseOperationActions().migrateDatabase(
		event({
			confirmation: 'migrate SQL data',
			destination_uuid: 'dest-1',
			migrate_volumes: 'false',
			clone_volumes: 'true'
		})
	);
	expect(request).toHaveBeenCalledWith('POST', '/databases/db-1/migrate', {
		body: { destination_uuid: 'dest-1', migrate_volumes: false }
	});
});
test('development-only migration rejection is shown as unavailable and never retried', async () => {
	request
		.mockResolvedValueOnce({ name: 'SQL data' })
		.mockRejectedValueOnce(new CoolifyError('Not found', 404));
	expect(
		await createDatabaseOperationActions().migrateDatabase(
			event({ confirmation: 'migrate SQL data', destination_uuid: 'dest-1' })
		)
	).toMatchObject({ status: 404, data: { error: expect.stringContaining('unavailable') } });
	expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
});
test('delete requires exact database name or UUID', async () => {
	request.mockResolvedValue({ name: 'SQL data' });
	expect(
		await createDatabaseDangerActions().deleteDatabase(event({ confirmation: 'yes' }))
	).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
});
test('delete sends every cleanup choice explicitly, defaulting absent destructive flags to false', async () => {
	request.mockResolvedValueOnce({ name: 'SQL data' }).mockResolvedValueOnce({});
	await expect(
		createDatabaseDangerActions().deleteDatabase(
			event({ confirmation: 'db-1', delete_volumes: 'true' })
		)
	).rejects.toMatchObject({ location: '/projects' });
	expect(request).toHaveBeenCalledWith('DELETE', '/databases/db-1', {
		query: {
			delete_configurations: false,
			delete_volumes: true,
			docker_cleanup: false,
			delete_connected_networks: false
		}
	});
});
