type Row = Record<string, unknown>;
interface Fixture {
	service: Row;
	apps: Row[];
	databases: Row[];
	variables: Row[];
	persistent: Row[];
	files: Row[];
	tasks: Row[];
	tags: Row[];
	backups: Map<string, Row>;
	executions: Map<string, Row[]>;
}
function fixture(uuid: string): Fixture {
	const apps = [
		{
			uuid: `${uuid}-web`,
			name: 'web',
			human_name: 'Frontend',
			image: 'nginx:alpine',
			fqdn: 'https://stack.example.com',
			noindex_domains: [],
			status: 'running:healthy'
		}
	];
	const databases = [
		{
			uuid: `${uuid}-db`,
			name: 'db',
			human_name: 'Database',
			image: 'postgres:17',
			status: 'running:healthy',
			public_port: null
		}
	];
	return {
		service: {
			uuid,
			name: 'Demo Stack',
			description: 'Compose service',
			environment_id: 1,
			status: 'running:healthy',
			docker_compose_raw: 'service-compose-secret',
			docker_compose: 'rendered-compose-secret',
			applications: apps,
			databases
		},
		apps,
		databases,
		variables: [
			{
				uuid: 'service-env-1',
				key: 'DATABASE_URL',
				value: 'service-env-secret',
				is_literal: false,
				is_multiline: false,
				is_shown_once: false,
				comment: 'Connection'
			}
		],
		persistent: [
			{
				uuid: 'service-storage-1',
				name: 'stack-data',
				mount_path: '/data',
				resource_uuid: `${uuid}-db`
			}
		],
		files: [],
		tasks: [],
		tags: [],
		backups: new Map(),
		executions: new Map()
	};
}
const fixtures = new Map(
	[
		'service-config',
		'service-data',
		'service-ops',
		'service-backups',
		'service-created',
		'service-template-created'
	].map((uuid) => [uuid, fixture(uuid)])
);
let sequence = 100;
const json = (value: unknown, status = 200) => Response.json(value, { status });
const missing = () => json({ message: 'Resource not found.' }, 404);
function extra(body: Row, allowed: string[]) {
	return Object.keys(body).some((key) => !allowed.includes(key));
}
const invalid = () => json({ message: 'Unexpected or invalid service payload.' }, 422);

export async function mockServices(request: Request): Promise<Response | undefined> {
	const url = new URL(request.url);
	const parts = url.pathname.split('/').filter(Boolean);
	if (parts[2] !== 'services' || !parts[3]) return undefined;
	const uuid = decodeURIComponent(parts[3]);
	const f = fixtures.get(uuid);
	if (!f) return missing();
	const rest = parts.slice(4).map(decodeURIComponent);
	const method = request.method;
	const body: Row = ['POST', 'PATCH', 'PUT'].includes(method)
		? await request.json().catch(() => ({}))
		: {};
	if (!rest.length) {
		if (method === 'GET') return json(f.service);
		if (method === 'DELETE') {
			fixtures.delete(uuid);
			return json({ message: 'Deleted' });
		}
		if (method === 'PATCH') {
			if (
				extra(body, [
					'name',
					'description',
					'instant_deploy',
					'connect_to_docker_network',
					'is_container_label_escape_enabled',
					'docker_compose_raw',
					'urls',
					'force_domain_override'
				])
			)
				return invalid();
			if (Array.isArray(body.urls)) {
				if (
					body.urls.some((row: Row) => String(row.url).includes('conflict.example.com')) &&
					!body.force_domain_override
				)
					return json(
						{
							message: 'Domain conflict',
							conflicts: [{ domain: 'conflict.example.com', resource_name: 'Existing app' }]
						},
						409
					);
				for (const row of body.urls as Row[]) {
					const app = f.apps.find((app) => app.name === row.name);
					if (!app) return invalid();
					app.fqdn = row.url;
				}
			}
			Object.assign(
				f.service,
				Object.fromEntries(
					Object.entries(body).filter(([key]) => !['urls', 'force_domain_override'].includes(key))
				)
			);
			return json({ uuid });
		}
	}
	if (['start', 'stop', 'restart'].includes(rest[0]) && method === 'POST')
		return json({ message: 'Lifecycle requested' });
	if (rest[0] === 'clone' && method === 'POST') {
		if (!body.destination_uuid || extra(body, ['destination_uuid', 'name', 'clone_volumes']))
			return invalid();
		const id = `service-clone-${++sequence}`;
		const clone = fixture(id);
		clone.service.name = body.name || 'Demo Stack copy';
		fixtures.set(id, clone);
		return json({ uuid: id }, 201);
	}
	if (rest[0] === 'move' && method === 'POST')
		return body.environment_uuid && !extra(body, ['environment_uuid'])
			? json({ message: 'Moved' })
			: invalid();
	if (rest[0] === 'migrate' && method === 'POST')
		return body.destination_uuid && !extra(body, ['destination_uuid', 'migrate_volumes'])
			? json({ message: 'Migration requested' })
			: invalid();
	if (rest[0] === 'logs' && method === 'GET') {
		const target = url.searchParams.get('sub_service_name');
		if (![...f.apps, ...f.databases].some((row) => row.name === target)) return invalid();
		const lines = Number(url.searchParams.get('lines'));
		if (lines < 1 || lines > 1000) return invalid();
		return json({ logs: `${target}: ready (${lines} lines)` });
	}
	if (['applications', 'databases'].includes(rest[0])) {
		const rows = rest[0] === 'applications' ? f.apps : f.databases;
		const row = rows.find((row) => row.uuid === rest[1]);
		if (!rest[1]) return json(rows);
		if (!row) return missing();
		if (method === 'GET') return json(row);
		if (rest[2] && method === 'POST') return json({ message: 'Container lifecycle requested' });
		if (method === 'PATCH') {
			const allowed =
				rest[0] === 'applications'
					? [
							'human_name',
							'description',
							'image',
							'url',
							'noindex_domains',
							'exclude_from_status',
							'is_log_drain_enabled',
							'is_gzip_enabled',
							'is_stripprefix_enabled',
							'is_force_https_enabled'
						]
					: [
							'human_name',
							'description',
							'image',
							'exclude_from_status',
							'is_log_drain_enabled',
							'is_public',
							'public_port',
							'public_port_timeout'
						];
			if (extra(body, allowed)) return invalid();
			Object.assign(row, body);
			return json(row);
		}
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
			const existing = f.variables.find((value) => value.key === row.key);
			if (existing) Object.assign(existing, row);
			else f.variables.push({ ...row, uuid: `service-env-${++sequence}` });
		}
		return json({ message: 'Variables saved' });
	}
	if (rest[0] === 'storages') {
		if (rest[2] === 'backups') {
			if (method === 'PUT') {
				f.backups.set(rest[1], body);
				return json(body);
			}
			if (method === 'DELETE') {
				f.backups.delete(rest[1]);
				return json({ message: 'Backup deleted' });
			}
			if (method === 'POST' && rest[3] === 'run')
				return f.backups.has(rest[1]) ? json({ message: 'Backup queued' }) : missing();
		}
		if (method === 'GET')
			return json({ persistent_storages: f.persistent, file_storages: f.files });
		if (method === 'DELETE') {
			f.persistent = f.persistent.filter((row) => row.uuid !== rest[1]);
			f.files = f.files.filter((row) => row.uuid !== rest[1]);
			return json({ message: 'Deleted' });
		}
		if (method === 'POST') {
			if (![...f.apps, ...f.databases].some((row) => row.uuid === body.resource_uuid))
				return invalid();
			if (
				extra(body, [
					'type',
					'resource_uuid',
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
			const row = { ...body, uuid: `service-storage-${++sequence}` };
			(body.type === 'persistent' ? f.persistent : f.files).push(row);
			return json(row, 201);
		}
		if (method === 'PATCH') {
			const row = [...f.persistent, ...f.files].find((row) => row.uuid === body.uuid);
			if (!row) return missing();
			Object.assign(row, body);
			return json(row);
		}
	}
	if (rest[0] === 'tags') {
		if (method === 'GET') return json(f.tags);
		if (method === 'POST') {
			for (const name of body.tag_names as string[])
				f.tags.push({ uuid: `tag-${++sequence}`, name });
			return json(f.tags);
		}
		if (method === 'DELETE') {
			f.tags = f.tags.filter((row) => row.uuid !== rest[1]);
			return json({ message: 'Removed' });
		}
	}
	if (rest[0] === 'scheduled-tasks') {
		if (rest[2] === 'executions') return json(f.executions.get(rest[1]) ?? []);
		if (rest[2] === 'execute' && method === 'POST') {
			f.executions.set(rest[1], [
				{ uuid: `exec-${++sequence}`, status: 'success', message: 'Task complete', duration: 1 }
			]);
			return json({ message: 'Queued' });
		}
		if (method === 'GET') return json(f.tasks);
		if (method === 'POST') {
			f.tasks.push({ ...body, uuid: `service-task-${++sequence}` });
			return json({ message: 'Created' });
		}
		if (method === 'PATCH') {
			const row = f.tasks.find((row) => row.uuid === rest[1]);
			if (!row) return missing();
			Object.assign(row, body);
			return json(row);
		}
		if (method === 'DELETE') {
			f.tasks = f.tasks.filter((row) => row.uuid !== rest[1]);
			return json({ message: 'Deleted' });
		}
	}
	return missing();
}
