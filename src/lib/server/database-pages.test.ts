import { describe, expect, test } from 'vitest';
import {
	databaseEngine,
	databaseFields,
	databaseSubmission,
	databaseOverview,
	databaseCredentials
} from './database-presenter';
import { redactSecrets } from './redact';

function form(values: Record<string, string>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values)) result.set(key, value);
	return result;
}

describe('database configuration contract', () => {
	test('reveals only credentials belonging to the selected engine, not nested infrastructure secrets', () => {
		expect(
			databaseCredentials({
				type: 'standalone-redis',
				redis_password: 'redis-secret',
				postgres_password: 'wrong-engine',
				internal_db_url: 'redis://:redis-secret@cache',
				destination: { server: { private_key: 'host-secret' } }
			})
		).toEqual([
			{ label: 'Internal db url', value: 'redis://:redis-secret@cache' },
			{ label: 'Redis password', value: 'redis-secret' }
		]);
	});
	test.each([
		['postgresql', 'postgres_password'],
		['mysql', 'mysql_root_password'],
		['mariadb', 'mariadb_root_password'],
		['mongodb', 'mongo_initdb_root_password'],
		['redis', 'redis_password'],
		['keydb', 'keydb_password'],
		['dragonfly', 'dragonfly_password'],
		['clickhouse', 'clickhouse_admin_password']
	])('offers the correct credentials for %s', (engine, password) => {
		expect(databaseEngine({ type: `standalone-${engine}` })).toBe(engine);
		const fields = databaseFields(engine);
		expect(fields.find((field) => field.name === password)).toMatchObject({
			sensitive: true,
			section: 'credentials'
		});
		expect(fields.some((field) => field.name === 'health_check_interval')).toBe(true);
	});
	test('never guesses an engine from a custom image', () => {
		expect(databaseEngine({ image: 'redis:7' })).toBe('unknown');
		expect(databaseFields('unknown').some((field) => field.name === 'redis_password')).toBe(false);
	});
	test('limits writes to the selected section and actual engine', () => {
		const submission = databaseSubmission(
			form({
				_section: 'general',
				name: 'Main',
				postgres_password: 'nope',
				redis_password: 'nope',
				is_public: 'true'
			}),
			'postgresql',
			'general'
		);
		expect(submission.body).toEqual({ name: 'Main' });
	});
	test('encodes configuration once and never preserves its secret text', () => {
		const result = databaseSubmission(
			form({ postgres_conf: 'password=hidden' }),
			'postgresql',
			'configuration'
		);
		expect(result.body).toEqual({ postgres_conf: 'cGFzc3dvcmQ9aGlkZGVu' });
		expect(JSON.stringify(result.values)).not.toContain('hidden');
	});
	test('rejects invalid ports and healthcheck ranges without replacing passwords with blanks', () => {
		expect(
			databaseSubmission(form({ public_port: '65536' }), 'redis', 'networking').fieldErrors
				.public_port
		).toBeTruthy();
		expect(
			databaseSubmission(form({ health_check_interval: '0' }), 'redis', 'healthcheck').fieldErrors
				.health_check_interval
		).toBeTruthy();
		expect(databaseSubmission(form({ redis_password: '' }), 'redis', 'credentials').body).toEqual(
			{}
		);
	});
	test('redacts connection strings, initialization scripts and configuration before serialization', () => {
		const value = {
			type: 'standalone-postgresql',
			internal_db_url: 'postgres://admin:secret@db',
			init_scripts: [{ content: 'secret' }],
			postgres_conf: 'password=secret',
			destination: { name: 'Docker', server: { name: 'Primary' } }
		};
		expect(JSON.stringify(redactSecrets(value))).not.toContain('secret');
		expect(databaseOverview(value)).toMatchObject({
			engine: 'postgresql',
			server: 'Primary',
			destination: 'Docker'
		});
	});
});
