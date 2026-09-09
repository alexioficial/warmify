// Stateful public API fixture: payload allowlists are independent of Warmify's presenters.
type Row = Record<string, unknown>;
function fixture(uuid: string, redis: boolean) {
	return {
		database: {
			uuid,
			type: redis ? 'standalone-redis' : 'standalone-postgresql',
			name: redis ? 'Cache database' : 'SQL database',
			description: redis ? 'Redis cache' : 'PostgreSQL data',
			image: redis ? 'redis:7' : 'postgres:17',
			environment_id: uuid === 'db-ops' ? 2 : 1,
			status: 'running:healthy',
			is_public: false,
			public_port: null,
			public_port_timeout: 30,
			health_check_enabled: true,
			health_check_interval: 30,
			health_check_timeout: 5,
			health_check_retries: 3,
			health_check_start_period: 0,
			destination: {
				name: 'Docker',
				server: { name: 'Primary server', private_key: 'database-host-secret' }
			},
			...(redis
				? {
						redis_password: 'redis-fixture-secret',
						redis_conf: 'requirepass redis-fixture-secret',
						internal_db_url: 'redis://:redis-fixture-secret@cache:6379'
					}
				: {
						postgres_user: 'postgres',
						postgres_db: 'postgres',
						postgres_password: 'postgres-fixture-secret',
						postgres_conf: 'password=postgres-config-secret',
						init_scripts: [{ content: 'init-fixture-secret' }],
						internal_db_url: 'postgres://postgres:postgres-fixture-secret@db:5432/postgres'
					})
		} as Row,
		variables: [
			{
				uuid: `${uuid}-env`,
				key: 'DB_MODE',
				value: 'database-env-secret',
				is_literal: false,
				is_multiline: false,
				is_shown_once: false
			}
		] as Row[],
		persistent: [{ uuid: `${uuid}-storage`, name: 'database-data', mount_path: '/data' }] as Row[],
		files: [] as Row[],
		backups: new Map<string, Row>(),
		schedules: [] as Row[],
		tags: [] as Row[],
		executions: new Map<string, Row[]>()
	};
}
const fixtures = new Map([
	['db-postgres', fixture('db-postgres', false)],
	['db-redis', fixture('db-redis', true)],
	['db-backups', fixture('db-backups', false)],
	['db-ops', fixture('db-ops', false)],
	['db-vars', fixture('db-vars', true)],
	['db-nav-a', fixture('db-nav-a', false)],
	['db-nav-b', fixture('db-nav-b', false)]
]);
fixtures.get('db-nav-a')!.database.name = 'Navigation A';
fixtures.get('db-nav-b')!.database.name = 'Navigation B';
let sequence = 100;
const json = (value: unknown, status = 200) => Response.json(value, { status });
const invalid = () => json({ message: 'Unexpected database payload.' }, 422);
const missing = () => json({ message: 'Database not found.' }, 404);
const extra = (body: Row, allowed: string[]) =>
	Object.keys(body).some((key) => !allowed.includes(key));
export async function mockDatabases(request: Request): Promise<Response | undefined> {
	const url = new URL(request.url);
	const parts = url.pathname.split('/').filter(Boolean);
	if (parts[2] !== 'databases' || !parts[3]) return undefined;
	const engineFields: Record<string, string[]> = {
		postgresql: [
			'postgres_user',
			'postgres_password',
			'postgres_db',
			'postgres_initdb_args',
			'postgres_host_auth_method',
			'postgres_conf'
		],
		mysql: ['mysql_root_password', 'mysql_password', 'mysql_user', 'mysql_database', 'mysql_conf'],
		mariadb: [
			'mariadb_root_password',
			'mariadb_password',
			'mariadb_user',
			'mariadb_database',
			'mariadb_conf'
		],
		mongodb: [
			'mongo_initdb_root_username',
			'mongo_initdb_root_password',
			'mongo_initdb_database',
			'mongo_conf'
		],
		redis: ['redis_password', 'redis_conf'],
		keydb: ['keydb_password', 'keydb_conf'],
		dragonfly: ['dragonfly_password'],
		clickhouse: ['clickhouse_admin_user', 'clickhouse_admin_password']
	};
	if (parts.length === 4 && engineFields[parts[3]] && request.method === 'POST') {
		const body = (await request.json()) as Row;
		const common = [
			'name',
			'description',
			'image',
			'public_port',
			'public_port_timeout',
			'is_public',
			'project_uuid',
			'environment_uuid',
			'server_uuid',
			'destination_uuid',
			'instant_deploy',
			'limits_memory',
			'limits_memory_swap',
			'limits_memory_swappiness',
			'limits_memory_reservation',
			'limits_cpus',
			'limits_cpuset',
			'limits_cpu_shares',
			'tags'
		];
		if (
			extra(body, [...common, ...engineFields[parts[3]]]) ||
			body.project_uuid !== 'project-1' ||
			body.environment_uuid !== 'environment-1' ||
			body.server_uuid !== 'server-1'
		)
			return invalid();
		if (body.name === 'Reject creation')
			return json(
				{ message: 'Validation failed.', errors: { name: ['Choose another name.'] } },
				422
			);
		if (
			body.public_port != null &&
			(!Number.isInteger(body.public_port) ||
				Number(body.public_port) < 1024 ||
				Number(body.public_port) > 65535)
		)
			return invalid();
		for (const [key, value] of Object.entries(body))
			if (
				key.endsWith('_conf') &&
				(typeof value !== 'string' ||
					!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
			)
				return invalid();
		const id = `db-created-${parts[3]}-${++sequence}`;
		const created = fixture(id, parts[3] === 'redis');
		created.database = {
			...created.database,
			...body,
			uuid: id,
			type: `standalone-${parts[3]}`,
			name: body.name || 'Created database',
			status: body.instant_deploy ? 'starting' : 'exited',
			environment_id: 1
		};
		fixtures.set(id, created);
		return json(
			{ uuid: id, internal_db_url: 'postgres://creation-response-secret@db:5432/data' },
			201
		);
	}
	const f = fixtures.get(parts[3]);
	if (!f) return missing();
	const rest = parts.slice(4);
	const method = request.method;
	const body: Row = ['POST', 'PATCH', 'PUT'].includes(method)
		? await request.json().catch(() => ({}))
		: {};
	if (!rest.length) {
		if (method === 'GET') return json(f.database);
		if (method === 'DELETE') {
			if (
				[
					'delete_configurations',
					'delete_volumes',
					'docker_cleanup',
					'delete_connected_networks'
				].some((key) => !['true', 'false'].includes(url.searchParams.get(key) ?? ''))
			)
				return invalid();
			fixtures.delete(parts[3]);
			return json({ message: 'Database deletion request queued.' });
		}
		if (method === 'PATCH') {
			const credentials =
				f.database.type === 'standalone-redis'
					? ['redis_password', 'redis_conf']
					: [
							'postgres_user',
							'postgres_db',
							'postgres_password',
							'postgres_conf',
							'postgres_initdb_args',
							'postgres_host_auth_method'
						];
			if (
				extra(body, [
					'name',
					'description',
					'image',
					'instant_deploy',
					'is_public',
					'public_port',
					'public_port_timeout',
					'health_check_enabled',
					'health_check_interval',
					'health_check_timeout',
					'health_check_retries',
					'health_check_start_period',
					'limits_memory',
					'limits_memory_swap',
					'limits_memory_reservation',
					'limits_cpus',
					'limits_cpuset',
					'limits_memory_swappiness',
					'limits_cpu_shares',
					...credentials
				])
			)
				return invalid();
			for (const [key, value] of Object.entries(body)) {
				if (key.endsWith('_conf')) {
					if (
						typeof value !== 'string' ||
						!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
					)
						return invalid();
					f.database[key] = Buffer.from(value, 'base64').toString('utf8');
				} else f.database[key] = value;
			}
			return json({ uuid: f.database.uuid });
		}
	}
	if (rest[0] === 'tags') {
		if (method === 'GET') return json(f.tags);
		if (method === 'POST') {
			if (
				extra(body, ['tag_names']) ||
				!Array.isArray(body.tag_names) ||
				!body.tag_names.length ||
				body.tag_names.some((name) => typeof name !== 'string' || name.length < 2)
			)
				return invalid();
			for (const name of body.tag_names)
				if (!f.tags.some((tag) => tag.name === name))
					f.tags.push({ uuid: `db-tag-${++sequence}`, name });
			return json(f.tags, 201);
		}
		if (method === 'DELETE') {
			if (!f.tags.some((tag) => tag.uuid === rest[1])) return missing();
			f.tags = f.tags.filter((tag) => tag.uuid !== rest[1]);
			return json({ message: 'Tag removed.' });
		}
	}
	if (rest[0] === 'clone' && method === 'POST') {
		if (
			extra(body, ['destination_uuid', 'name', 'clone_volumes']) ||
			body.destination_uuid !== 'destination-1' ||
			typeof body.clone_volumes !== 'boolean'
		)
			return invalid();
		const id = `db-copy-${++sequence}`;
		const copy = fixture(id, f.database.type === 'standalone-redis');
		copy.database = {
			...f.database,
			uuid: id,
			name: body.name || 'Database copy',
			status: 'exited'
		};
		fixtures.set(id, copy);
		return json({ uuid: id }, 201);
	}
	if (rest[0] === 'move' && method === 'POST') {
		if (extra(body, ['environment_uuid']) || body.environment_uuid !== 'environment-1')
			return invalid();
		if (f.database.environment_id === 1)
			return json({ message: 'Database is already in this environment.' }, 400);
		f.database.environment_id = 1;
		return json({
			uuid: f.database.uuid,
			project_uuid: 'project-1',
			environment_uuid: 'environment-1'
		});
	}
	if (rest[0] === 'migrate' && method === 'POST') {
		if (
			extra(body, ['destination_uuid', 'migrate_volumes']) ||
			body.destination_uuid !== 'destination-1' ||
			typeof body.migrate_volumes !== 'boolean'
		)
			return invalid();
		// Simulates a development-enabled installation; production rejection is a contract test.
		f.database.status = 'exited';
		f.database.destination = {
			uuid: 'destination-1',
			name: 'Migration destination',
			server: { name: 'Target server' }
		};
		return json({
			uuid: f.database.uuid,
			destination_uuid: 'destination-1',
			async: false,
			volume_jobs: 0
		});
	}
	if (rest[0] === 'logs' && method === 'GET') {
		const lines = Number(url.searchParams.get('lines'));
		if (lines < 1 || lines > 1000 || url.searchParams.has('sub_service_name')) return invalid();
		return json({ logs: `${f.database.name}: ready (${lines} lines)` });
	}
	if (rest[0] === 'backups') {
		if (f.database.type === 'standalone-redis') return invalid();
		const schedule = f.schedules.find((row) => row.uuid === rest[1]);
		if (rest[1] && !schedule) return missing();
		if (rest[2] === 'executions') {
			if (method === 'GET') return json({ executions: f.executions.get(rest[1]) ?? [] });
			if (method === 'DELETE') {
				if (!['true', 'false'].includes(url.searchParams.get('delete_s3') ?? '')) return invalid();
				f.executions.set(
					rest[1],
					(f.executions.get(rest[1]) ?? []).filter((row) => row.uuid !== rest[3])
				);
				return json({ message: 'Deleted' });
			}
		}
		if (method === 'GET') return json(f.schedules);
		if (method === 'DELETE') {
			if (!['true', 'false'].includes(url.searchParams.get('delete_s3') ?? '')) return invalid();
			f.schedules = f.schedules.filter((row) => row.uuid !== rest[1]);
			f.executions.delete(rest[1]);
			return json({ message: 'Deleted' });
		}
		const allowed = [
			'frequency',
			'timeout',
			'enabled',
			'save_s3',
			'dump_all',
			's3_storage_uuid',
			'databases_to_backup',
			'backup_now',
			'database_backup_retention_amount_locally',
			'database_backup_retention_days_locally',
			'database_backup_retention_max_storage_locally',
			'database_backup_retention_amount_s3',
			'database_backup_retention_days_s3',
			'database_backup_retention_max_storage_s3'
		];
		if (extra(body, allowed)) return invalid();
		if (body.frequency === 'invalid')
			return json(
				{ message: 'Invalid frequency', errors: { frequency: ['Invalid cron expression'] } },
				422
			);
		if (body.save_s3 === true && body.s3_storage_uuid !== 's3-1') return invalid();
		const target = schedule ?? {
			uuid: `native-backup-${++sequence}`,
			enabled: true,
			save_s3: false,
			frequency: 'daily'
		};
		Object.assign(
			target,
			Object.fromEntries(
				Object.entries(body).filter(([key]) => !['backup_now', 's3_storage_uuid'].includes(key))
			)
		);
		if (body.s3_storage_uuid) target.s3_storage_id = 7;
		if (!schedule) f.schedules.push(target);
		if (body.backup_now === true)
			f.executions.set(String(target.uuid), [
				{
					uuid: `backup-execution-${++sequence}`,
					filename: '/backups/database.dump',
					size: 1024,
					status: 'success',
					created_at: '2026-09-04T12:00:00Z',
					message: 'Backup completed postgres-fixture-secret',
					token: 'backup-output-secret'
				}
			]);
		return json({ uuid: target.uuid });
	}
	if (rest[0] === 'envs') {
		if (method === 'GET') return json(f.variables);
		if (method === 'DELETE') {
			f.variables = f.variables.filter((row) => row.uuid !== rest[1]);
			return json({ message: 'Deleted' });
		}
		const rows = rest[1] === 'bulk' ? (body.data as Row[]) : [body];
		if (
			!Array.isArray(rows) ||
			rows.some(
				(row) =>
					!row.key ||
					extra(row, ['key', 'value', 'is_literal', 'is_multiline', 'is_shown_once', 'comment'])
			)
		)
			return invalid();
		for (const row of rows) {
			const existing = f.variables.find((item) => item.key === row.key);
			if (existing) Object.assign(existing, row);
			else f.variables.push({ ...row, uuid: `database-env-${++sequence}` });
		}
		return json({ message: 'Saved' });
	}
	if (rest[0] === 'storages') {
		if (rest[2] === 'backups') {
			if (method === 'PUT') {
				f.backups.set(rest[1], body);
				return json(body);
			}
			if (method === 'POST' && rest[3] === 'run')
				return f.backups.has(rest[1]) ? json({ message: 'Queued' }) : missing();
			if (method === 'DELETE') {
				f.backups.delete(rest[1]);
				return json({ message: 'Deleted' });
			}
		}
		if (method === 'GET')
			return json({ persistent_storages: f.persistent, file_storages: f.files });
		if (method === 'POST') {
			if (
				extra(body, [
					'type',
					'name',
					'mount_path',
					'host_path',
					'content',
					'is_directory',
					'is_host_file',
					'fs_path'
				])
			)
				return invalid();
			const row = { ...body, uuid: `database-storage-${++sequence}` };
			(body.type === 'persistent' ? f.persistent : f.files).push(row);
			return json(row, 201);
		}
		if (method === 'PATCH') {
			const row = [...f.persistent, ...f.files].find((item) => item.uuid === body.uuid);
			if (
				!row ||
				extra(body, [
					'uuid',
					'type',
					'name',
					'mount_path',
					'host_path',
					'content',
					'is_directory',
					'is_host_file',
					'fs_path'
				])
			)
				return invalid();
			Object.assign(row, body);
			return json(row);
		}
		if (method === 'DELETE') {
			f.persistent = f.persistent.filter((row) => row.uuid !== rest[1]);
			f.files = f.files.filter((row) => row.uuid !== rest[1]);
			return json({ message: 'Deleted' });
		}
	}
	return missing();
}
