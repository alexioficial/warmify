import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import {
	backupSubmission,
	backupSummary,
	nativeBackupSupported
} from './database-backup-presenter';
import { createDatabaseBackupActions } from './database-backups';
function form(values: Record<string, string>) {
	const data = new FormData();
	for (const [key, value] of Object.entries(values)) data.set(key, value);
	return data;
}
function event(values: Record<string, string>, backup = 'backup-1') {
	return {
		params: { uuid: 'db-1', backup },
		locals: { user: { username: 'admin' } },
		request: new Request('http://localhost/backup', { method: 'POST', body: form(values) })
	} as unknown as RequestEvent;
}
beforeEach(() => request.mockReset());
describe('native database backups', () => {
	test.each(['postgresql', 'mysql', 'mariadb', 'mongodb', 'clickhouse'])(
		'supports native dumps for %s',
		(engine) => expect(nativeBackupSupported(engine)).toBe(true)
	);
	test.each(['redis', 'keydb', 'dragonfly', 'unknown'])(
		'does not offer native dumps for %s',
		(engine) => expect(nativeBackupSupported(engine)).toBe(false)
	);
	test('parses decimal storage limits and omits unsupported volume-backup fields and backup_now', () => {
		const result = backupSubmission(
			form({
				frequency: 'daily',
				timeout: '120',
				database_backup_retention_max_storage_locally: '1.5',
				disable_local_backup: 'true',
				backup_now: 'true'
			}),
			true
		);
		expect(result.body).toEqual({
			frequency: 'daily',
			timeout: 120,
			database_backup_retention_max_storage_locally: 1.5
		});
	});
	test('requires a schedule frequency and a destination when enabling S3', () => {
		expect(
			backupSubmission(form({ save_s3: 'true', timeout: '59' }), true).fieldErrors
		).toMatchObject({
			frequency: expect.any(String),
			s3_storage_uuid: expect.any(String),
			timeout: expect.any(String)
		});
	});
	test('maps the existing S3 numeric identity without leaking S3 secrets or embedded output', () => {
		const result = backupSummary(
			{
				uuid: 'b1',
				frequency: 'daily',
				enabled: 1,
				save_s3: 1,
				s3_storage_id: 7,
				executions: [{ message: 'do-not-serialize' }],
				token: 'hidden'
			},
			[{ id: 7, uuid: 's3-1', name: 'Backups', is_usable: true, secret_access_key: 'secret' }]
		);
		expect(result.values).toMatchObject({ s3_storage_uuid: 's3-1', enabled: true, save_s3: true });
		expect(JSON.stringify(result)).not.toMatch(/do-not-serialize|hidden|secret/);
	});
	test('rejects a schedule UUID outside the parent database before running it', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-postgresql' })
			.mockResolvedValueOnce([{ uuid: 'other' }]);
		expect(
			await createDatabaseBackupActions().run(event({ confirmation: 'run backup-1' }))
		).toMatchObject({ status: 404 });
		expect(request.mock.calls.filter(([method]) => method === 'PATCH')).toHaveLength(0);
	});
	test('queues a confirmed run by PATCHing only backup_now on the selected schedule', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-postgresql' })
			.mockResolvedValueOnce([{ uuid: 'backup-1' }])
			.mockResolvedValueOnce({});
		await createDatabaseBackupActions().run(
			event({ confirmation: 'run backup-1', frequency: 'injected' })
		);
		expect(request).toHaveBeenLastCalledWith('PATCH', '/databases/db-1/backups/backup-1', {
			body: { backup_now: true }
		});
	});
	test('blocks an unconfirmed schedule deletion', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-postgresql' })
			.mockResolvedValueOnce([{ uuid: 'backup-1' }]);
		expect(
			await createDatabaseBackupActions().deleteSchedule(event({ confirmation: 'yes' }))
		).toMatchObject({ status: 400 });
		expect(request.mock.calls.filter(([method]) => method === 'DELETE')).toHaveLength(0);
	});
	test('checks execution ownership before deletion', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-postgresql' })
			.mockResolvedValueOnce([{ uuid: 'backup-1' }])
			.mockResolvedValueOnce({ executions: [{ uuid: 'owned' }] });
		expect(
			await createDatabaseBackupActions().deleteExecution(
				event({ execution_uuid: 'foreign', confirmation: 'foreign' })
			)
		).toMatchObject({ status: 404 });
		expect(request.mock.calls.filter(([method]) => method === 'DELETE')).toHaveLength(0);
	});
	test('sends an explicit false S3 cleanup choice when deleting a local execution', async () => {
		request
			.mockResolvedValueOnce({ type: 'standalone-postgresql' })
			.mockResolvedValueOnce([{ uuid: 'backup-1' }])
			.mockResolvedValueOnce({ executions: [{ uuid: 'exec-1' }] })
			.mockResolvedValueOnce({});
		await createDatabaseBackupActions().deleteExecution(
			event({ execution_uuid: 'exec-1', confirmation: 'exec-1' })
		);
		expect(request).toHaveBeenLastCalledWith(
			'DELETE',
			'/databases/db-1/backups/backup-1/executions/exec-1',
			{ query: { delete_s3: false } }
		);
	});
});
