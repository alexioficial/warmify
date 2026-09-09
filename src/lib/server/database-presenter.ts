import { asRecord, firstText } from '../resource-presenter';
import { configurationSubmission } from './resource-actions';
import type { ConfigurationField } from './resource-groups';

export const databaseEngines = [
	'postgresql',
	'mysql',
	'mariadb',
	'mongodb',
	'redis',
	'keydb',
	'dragonfly',
	'clickhouse'
] as const;
export function databaseEngine(value: unknown): string {
	const type = firstText(asRecord(value), ['type', 'database_type']).replace(/^standalone-/, '');
	return databaseEngines.some((engine) => engine === type) ? type : 'unknown';
}
const engineFields: Record<string, string[]> = {
	postgresql: ['postgres_user', 'postgres_password', 'postgres_db'],
	mysql: ['mysql_root_password', 'mysql_user', 'mysql_password', 'mysql_database'],
	mariadb: ['mariadb_root_password', 'mariadb_user', 'mariadb_password', 'mariadb_database'],
	mongodb: ['mongo_initdb_root_username', 'mongo_initdb_root_password', 'mongo_initdb_database'],
	redis: ['redis_password'],
	keydb: ['keydb_password'],
	dragonfly: ['dragonfly_password'],
	clickhouse: ['clickhouse_admin_user', 'clickhouse_admin_password']
};
const configurationKeys: Record<string, string> = {
	postgresql: 'postgres_conf',
	mysql: 'mysql_conf',
	mariadb: 'mariadb_conf',
	mongodb: 'mongo_conf',
	redis: 'redis_conf',
	keydb: 'keydb_conf'
};
function label(name: string) {
	return name.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
export function databaseFields(engine: string): ConfigurationField[] {
	const fields: ConfigurationField[] = [
		{ name: 'name', label: 'Name', section: 'general' },
		{ name: 'description', label: 'Description', type: 'textarea', section: 'general' },
		{ name: 'image', label: 'Container image', section: 'general' },
		{
			name: 'instant_deploy',
			label: 'Deploy after saving',
			type: 'checkbox',
			coerce: 'boolean',
			section: 'general'
		},
		{
			name: 'is_public',
			label: 'Expose database publicly',
			type: 'checkbox',
			coerce: 'boolean',
			section: 'networking'
		},
		{
			name: 'public_port',
			label: 'Public port',
			type: 'number',
			coerce: 'integer',
			nullable: true,
			min: 1,
			max: 65535,
			section: 'networking'
		},
		{
			name: 'public_port_timeout',
			label: 'Public port timeout (seconds)',
			type: 'number',
			coerce: 'integer',
			nullable: true,
			min: 1,
			section: 'networking'
		},
		{
			name: 'health_check_enabled',
			label: 'Enable healthcheck',
			type: 'checkbox',
			coerce: 'boolean',
			section: 'healthcheck'
		},
		...['interval', 'timeout', 'retries', 'start_period'].map((suffix): ConfigurationField => ({
			name: `health_check_${suffix}`,
			label: label(suffix),
			type: 'number',
			coerce: 'integer',
			min: suffix === 'start_period' ? 0 : 1,
			section: 'healthcheck'
		})),
		...['memory', 'memory_swap', 'memory_reservation', 'cpus', 'cpuset'].map(
			(suffix): ConfigurationField => ({
				name: `limits_${suffix}`,
				label: label(suffix),
				section: 'resource-limits'
			})
		),
		{
			name: 'limits_memory_swappiness',
			label: 'Memory swappiness',
			type: 'number',
			coerce: 'integer',
			min: 0,
			max: 100,
			section: 'resource-limits'
		},
		{
			name: 'limits_cpu_shares',
			label: 'CPU shares',
			type: 'number',
			coerce: 'integer',
			min: 0,
			section: 'resource-limits'
		},
		...(engineFields[engine] ?? []).map((name): ConfigurationField => ({
			name,
			label: label(name),
			section: 'credentials',
			type: name.includes('password') ? 'password' : 'text',
			sensitive: name.includes('password')
		}))
	];
	if (engine === 'postgresql')
		fields.push(
			{
				name: 'postgres_initdb_args',
				label: 'Initialization arguments',
				section: 'initialization'
			},
			{
				name: 'postgres_host_auth_method',
				label: 'Host authentication method',
				section: 'initialization'
			}
		);
	if (configurationKeys[engine])
		fields.push({
			name: configurationKeys[engine],
			label: 'Configuration document',
			type: 'textarea',
			coerce: 'base64',
			sensitive: true,
			section: 'configuration'
		});
	return fields;
}
export function databaseSubmission(form: FormData, engine: string, section: string) {
	return configurationSubmission(
		form,
		databaseFields(engine).filter((field) => field.section === section)
	);
}
export function databaseOverview(value: unknown) {
	const record = asRecord(value);
	const destination = asRecord(record?.destination);
	return {
		engine: databaseEngine(record),
		server:
			firstText(asRecord(destination?.server) ?? asRecord(record?.server), ['name']) ||
			'Not provided by Coolify',
		destination: firstText(destination, ['name']) || 'Not provided by Coolify',
		public: record?.is_public === true || record?.is_public === 1,
		port: firstText(record, ['public_port']) || 'Not configured'
	};
}
export function databaseCredentials(value: unknown) {
	const record = asRecord(value);
	const keys = [
		'internal_db_url',
		'external_db_url',
		...(engineFields[databaseEngine(value)] ?? [])
	];
	return keys.flatMap((key) =>
		typeof record?.[key] === 'string' && record[key]
			? [{ label: label(key), value: String(record[key]) }]
			: []
	);
}
