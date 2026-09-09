import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import { databaseCreationSubmission, createDatabase } from './database-creation';
import { CoolifyError } from './coolify-client';
const engines = [
	['postgresql', 'postgres_password', 'postgres_conf'],
	['mysql', 'mysql_password', 'mysql_conf'],
	['mariadb', 'mariadb_password', 'mariadb_conf'],
	['mongodb', 'mongo_initdb_root_password', 'mongo_conf'],
	['redis', 'redis_password', 'redis_conf'],
	['keydb', 'keydb_password', 'keydb_conf'],
	['dragonfly', 'dragonfly_password', ''],
	['clickhouse', 'clickhouse_admin_password', '']
] as const;
function form(values: Record<string, string>) {
	const f = new FormData();
	for (const [key, value] of Object.entries(values)) f.set(key, value);
	return f;
}
function event(kind: string, values: Record<string, string>) {
	return {
		params: { uuid: 'p1', environment: 'e1', kind },
		locals: { user: { username: 'admin' } },
		request: new Request('http://localhost/create', { method: 'POST', body: form(values) })
	} as unknown as RequestEvent;
}
beforeEach(() => request.mockReset());
test.each(engines)(
	'%s creation isolates engine fields, encodes documents and never preserves secrets',
	(engine, password, config) => {
		const input: Record<string, string> = {
			server_uuid: 's1',
			name: 'Data',
			[password]: 'new-db-secret',
			...(config ? { [config]: 'config=secret' } : {}),
			health_check_enabled: 'true',
			git_repository: 'ignored',
			engine: 'oracle',
			tags: 'data, data, production'
		};
		const result = databaseCreationSubmission(form(input), engine);
		expect(result.fieldErrors).toEqual({});
		expect(result.body).toEqual({
			server_uuid: 's1',
			name: 'Data',
			[password]: 'new-db-secret',
			...(config ? { [config]: 'Y29uZmlnPXNlY3JldA==' } : {}),
			tags: ['data', 'production']
		});
		expect(JSON.stringify(result.values)).not.toMatch(/new-db-secret|config=secret|oracle|ignored/);
	}
);
test('blank creation fields preserve Coolify defaults, including generated passwords', () => {
	expect(
		databaseCreationSubmission(
			form({
				server_uuid: 's1',
				name: '',
				image: '',
				postgres_user: '',
				postgres_password: '',
				limits_cpu_shares: '',
				public_port: ''
			}),
			'postgresql'
		).body
	).toEqual({ server_uuid: 's1' });
});
test.each(['1023', '65536', '1.5', 'not-a-port'])(
	'rejects invalid creation public port %s',
	(port) => {
		expect(
			databaseCreationSubmission(form({ server_uuid: 's1', public_port: port }), 'redis')
				.fieldErrors.public_port
		).toBeTruthy();
	}
);
test('public access requires an explicit port and valid tag names', () => {
	const result = databaseCreationSubmission(form({ is_public: 'true', tags: 'x' }), 'redis');
	expect(Object.keys(result.fieldErrors)).toEqual(
		expect.arrayContaining(['server_uuid', 'public_port', 'tags'])
	);
});
test.each(engines)(
	'%s action uses route hierarchy and redirects without leaking connection URLs',
	async (engine, password) => {
		request
			.mockResolvedValueOnce({ uuid: 'e1', name: 'production' })
			.mockResolvedValueOnce({ uuid: 'new-db', internal_db_url: 'postgres://response-secret' });
		await expect(
			createDatabase(
				event(engine, {
					server_uuid: 's1',
					[password]: 'input-secret',
					project_uuid: 'foreign',
					environment_uuid: 'foreign'
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/databases/new-db/general' });
		expect(request).toHaveBeenCalledWith('POST', `/databases/${engine}`, {
			body: {
				server_uuid: 's1',
				[password]: 'input-secret',
				project_uuid: 'p1',
				environment_uuid: 'e1'
			}
		});
	}
);
test('rejects environment mismatches before creating a database', async () => {
	request.mockResolvedValue({ uuid: 'other' });
	expect(await createDatabase(event('redis', { server_uuid: 's1' }))).toMatchObject({
		status: 404
	});
	expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
});
test('API errors retain safe values but scrub submitted passwords and configuration', async () => {
	request.mockResolvedValueOnce({ uuid: 'e1' }).mockRejectedValueOnce(
		new CoolifyError('Rejected input-secret config-secret', 422, {
			errors: { postgres_password: ['input-secret'], postgres_conf: ['config-secret'] }
		})
	);
	const result = await createDatabase(
		event('postgresql', {
			server_uuid: 's1',
			name: 'Keep',
			postgres_password: 'input-secret',
			postgres_conf: 'config-secret'
		})
	);
	expect(result).toMatchObject({
		status: 422,
		data: { values: { server_uuid: 's1', name: 'Keep' } }
	});
	expect(JSON.stringify(result)).not.toMatch(/input-secret|config-secret/);
});
