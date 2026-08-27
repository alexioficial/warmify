export type ResourceRecord = Record<string, unknown>;

export interface ResourceSummary {
	id: string;
	name: string;
	description: string;
	status: string;
	context: string;
	type: string;
}

export interface DeploymentSummary {
	id: string;
	name: string;
	status: string;
	message: string;
	createdAt: string;
	environment: string;
	server: string;
}

export interface ProjectStats {
	environments: number;
	resources: number;
}

export interface ProjectResource extends ResourceSummary {
	group: 'applications' | 'services' | 'databases';
}

export interface ProjectEnvironment {
	id: string;
	name: string;
	description: string;
	resources: ProjectResource[];
}

const ENVIRONMENT_RESOURCE_GROUPS: ReadonlyArray<{
	group: ProjectResource['group'];
	keys: readonly string[];
}> = [
	{ group: 'applications', keys: ['applications'] },
	{ group: 'services', keys: ['services'] },
	{
		group: 'databases',
		keys: [
			'databases',
			'postgresqls',
			'mysqls',
			'mariadbs',
			'mongodbs',
			'redis',
			'keydbs',
			'dragonflies',
			'clickhouses'
		]
	}
];

export interface EnvironmentVariableSummary {
	id: string;
	key: string;
	value: string;
	scope: string;
}

const GROUP_TYPES: Record<string, string> = {
	applications: 'Application',
	services: 'Service',
	databases: 'Database',
	projects: 'Project',
	servers: 'Server',
	deployments: 'Deployment',
	destinations: 'Destination',
	sources: 'Source',
	storage: 'S3 storage',
	security: 'Private key',
	teams: 'Team'
};

export function asRecord(value: unknown): ResourceRecord | undefined {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as ResourceRecord)
		: undefined;
}

export function normalizeRecords(value: unknown): ResourceRecord[] {
	if (Array.isArray(value)) return value.map(asRecord).filter((row) => row !== undefined);
	const record = asRecord(value);
	if (!record) return [];
	for (const key of ['data', 'deployments', 'resources', 'items']) {
		if (Array.isArray(record[key])) return normalizeRecords(record[key]);
	}
	return [];
}

export function firstText(record: ResourceRecord | undefined, keys: string[]): string {
	if (!record) return '';
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	}
	return '';
}

function nestedText(record: ResourceRecord | undefined, key: string, fields: string[]): string {
	return firstText(asRecord(record?.[key]), fields);
}

export function humanize(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return 'Unknown';
	return value
		.trim()
		.split(':')
		.map((part, index) => {
			const words = part.replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase();
			return index === 0 ? words.replace(/^./, (character) => character.toUpperCase()) : words;
		})
		.join(' - ');
}

export function resourceSummary(value: unknown, group: string): ResourceSummary {
	const record = asRecord(value);
	const id = firstText(record, ['uuid', 'deployment_uuid', 'id']);
	const name = firstText(record, [
		'name',
		'application_name',
		'description',
		'fqdn',
		'ip',
		'uuid',
		'id'
	]);
	const statusValue = firstText(record, ['status', 'health', 'validation_status']);
	const environment =
		nestedText(record, 'environment', ['name']) || firstText(record, ['environment_name']);
	const server = nestedText(record, 'server', ['name']) || firstText(record, ['server_name']);
	const context = [environment, server].filter(Boolean).join(' - ');
	const description = firstText(record, [
		'description',
		'fqdn',
		'ip',
		'git_repository',
		'repository_project_id',
		'email'
	]);

	return {
		id,
		name: name || GROUP_TYPES[group] || 'Resource',
		description,
		status: statusValue ? humanize(statusValue) : 'Unknown',
		context,
		type: GROUP_TYPES[group] || humanize(group)
	};
}

export function deploymentSummary(value: unknown): DeploymentSummary {
	const record = asRecord(value);
	return {
		id: firstText(record, ['deployment_uuid', 'uuid', 'id']),
		name: firstText(record, ['application_name', 'name', 'application_uuid']) || 'Deployment',
		status: humanize(firstText(record, ['status'])),
		message: firstText(record, ['commit_message', 'message', 'commit', 'git_commit_sha']),
		createdAt: firstText(record, ['created_at', 'started_at', 'updated_at']),
		environment:
			nestedText(record, 'environment', ['name']) || firstText(record, ['environment_name']),
		server: nestedText(record, 'server', ['name']) || firstText(record, ['server_name'])
	};
}

export function projectStats(value: unknown): ProjectStats {
	const record = asRecord(value);
	const environments = normalizeRecords(record?.environments);
	const explicitEnvironments = Number(firstText(record, ['environments_count']));
	const explicitResources = Number(firstText(record, ['resources_count']));
	const resources = environments.reduce(
		(total, environment) => total + environmentResources(environment).length,
		0
	);
	return {
		environments:
			Number.isFinite(explicitEnvironments) && explicitEnvironments > 0
				? explicitEnvironments
				: environments.length,
		resources:
			Number.isFinite(explicitResources) && explicitResources > 0 ? explicitResources : resources
	};
}

export function environmentVariableSummary(value: unknown): EnvironmentVariableSummary {
	const record = asRecord(value);
	const scopes = [
		record?.is_build_time === true ? 'Build time' : '',
		record?.is_preview === true ? 'Preview' : '',
		record?.is_runtime === true ? 'Runtime' : ''
	].filter(Boolean);
	return {
		id: firstText(record, ['uuid', 'id', 'key']),
		key: firstText(record, ['key']) || 'Unnamed variable',
		value: firstText(record, ['value']) || '-',
		scope: scopes.join(' - ') || 'Runtime'
	};
}

export function logText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) {
		return value
			.map((entry) => {
				if (typeof entry === 'string') return entry;
				return firstText(asRecord(entry), ['output', 'message', 'log', 'text']);
			})
			.filter(Boolean)
			.join('\n');
	}
	return firstText(asRecord(value), ['logs', 'output', 'message', 'log']);
}

export function projectEnvironments(value: unknown): ProjectEnvironment[] {
	const project = asRecord(value);
	const environments = normalizeRecords(project?.environments ?? value);
	return environments.map((environment, index) => {
		const resources = environmentResources(environment);
		return {
			id: firstText(environment, ['uuid', 'id']) || String(index),
			name: firstText(environment, ['name']) || 'Environment',
			description: firstText(environment, ['description']),
			resources
		};
	});
}

export function environmentResources(value: unknown): ProjectResource[] {
	const environment = asRecord(value);
	if (!environment) return [];
	const resources: ProjectResource[] = [];
	const seen = new Set<string>();
	for (const { group, keys } of ENVIRONMENT_RESOURCE_GROUPS) {
		for (const key of keys) {
			for (const resource of normalizeRecords(environment[key])) {
				const summary = resourceSummary(resource, group);
				const identity = `${group}:${summary.id || summary.name}`;
				if (seen.has(identity)) continue;
				seen.add(identity);
				resources.push({ ...summary, group });
			}
		}
	}
	return resources;
}

export function additionalData(value: unknown, knownKeys: readonly string[]): ResourceRecord {
	const record = asRecord(value);
	if (!record) return {};
	const known = new Set(knownKeys);
	return Object.fromEntries(Object.entries(record).filter(([key]) => !known.has(key)));
}

export function formatTimestamp(value: unknown): string {
	if (typeof value !== 'string' || !value) return '-';
	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) return value;
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(timestamp);
}

export function formatRelativeTime(value: unknown, now = new Date()): string {
	if (typeof value !== 'string' || !value) return '-';
	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) return value;
	const seconds = Math.round((timestamp.getTime() - now.getTime()) / 1000);
	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	for (const [unit, divisor] of [
		['day', 86_400],
		['hour', 3_600],
		['minute', 60]
	] as const) {
		if (Math.abs(seconds) >= divisor) return formatter.format(Math.round(seconds / divisor), unit);
	}
	return formatter.format(seconds, 'second');
}

export function versionLabel(value: unknown): string {
	if (typeof value === 'string' && value.trim()) return value.trim();
	return firstText(asRecord(value), ['version']) || 'Unavailable';
}
