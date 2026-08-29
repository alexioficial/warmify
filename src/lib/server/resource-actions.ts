import { isIP } from 'node:net';

import type { CoolifyMethod, CoolifyRequestOptions } from './coolify-client';
import { CoolifyError } from './coolify-client';
import { buildEndpointRequest, getEndpoint } from './endpoint-manifest';
import type { ConfigurationField } from './resource-groups';

export interface ContextualRequest {
	method: CoolifyMethod;
	path: string;
	options?: CoolifyRequestOptions;
}

export interface NewResourceInput {
	kind:
		| 'public-repository'
		| 'private-deploy-key'
		| 'github-app'
		| 'dockerfile'
		| 'docker-compose'
		| 'docker-image'
		| 'service'
		| 'database';
	projectUuid: string;
	serverUuid: string;
	environmentUuid: string;
	environmentName: string;
	destinationUuid: string;
	name: string;
	description: string;
	instantDeploy: boolean;
	fields: Record<string, string>;
}

const LIFECYCLE_GROUPS = new Set(['applications', 'services', 'databases']);
const LIFECYCLE_ACTIONS = new Set(['start', 'stop', 'restart']);

export function resourceActionRequest(
	group: string,
	uuid: string,
	action: string
): ContextualRequest {
	if (group === 'applications' && action === 'deploy') {
		const endpoint = getEndpoint('POST:/deploy');
		return buildEndpointRequest(endpoint, {}, { query: { uuid } });
	}
	if (!LIFECYCLE_GROUPS.has(group) || !LIFECYCLE_ACTIONS.has(action)) {
		throw new Error('Action is not available for this resource');
	}
	const endpoint = getEndpoint(`POST:/${group}/{uuid}/${action}`);
	return buildEndpointRequest(endpoint, { uuid });
}

export function configurationBody(
	form: FormData,
	allowedFields: readonly string[]
): Record<string, string> {
	return Object.fromEntries(
		allowedFields
			.filter((field) => form.has(field))
			.map((field) => [field, String(form.get(field) ?? '').trim()])
	);
}

export interface ConfigurationSubmission {
	body: Record<string, unknown>;
	values: Record<string, string | boolean>;
	sensitiveValues: string[];
	fieldErrors: Record<string, string>;
}

export interface ApplicationDomainRow {
	url: string;
	noindex: boolean;
}

export interface ApplicationDomainState {
	rows: ApplicationDomainRow[];
	redirect: '' | 'www' | 'non-www' | 'both';
	forceHttps: boolean;
}

export interface ApplicationDomainSubmission extends ApplicationDomainState {
	body?: {
		domains: string;
		noindex_domains: string[];
		redirect: 'www' | 'non-www' | 'both' | null;
		is_force_https_enabled: boolean;
		force_domain_override?: true;
	};
	rowErrors: Record<number, string>;
}

export interface ApplicationDomainConflict {
	domain: string;
	resourceName: string;
	resourceUuid: string;
	resourceType: string;
	message: string;
}

export interface ApplicationDomainFailure {
	error: string;
	fieldError: string | undefined;
	warning: string | undefined;
	conflicts: ApplicationDomainConflict[];
}

const DOMAIN_REDIRECTS = new Set(['www', 'non-www', 'both']);

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function booleanValue(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

function domainRedirect(value: unknown): ApplicationDomainState['redirect'] {
	return typeof value === 'string' && DOMAIN_REDIRECTS.has(value)
		? (value as ApplicationDomainState['redirect'])
		: '';
}

export function applicationDomainState(value: unknown): ApplicationDomainState {
	const application = record(value);
	const settings = record(application?.settings);
	const rawDomains =
		typeof application?.fqdn === 'string'
			? application.fqdn
			: typeof application?.domains === 'string'
				? application.domains
				: '';
	const noindex = new Set(
		Array.isArray(application?.noindex_domains)
			? application.noindex_domains.filter(
					(domain): domain is string => typeof domain === 'string' && domain.trim() !== ''
				)
			: []
	);
	return {
		rows: rawDomains
			.split(',')
			.map((url) => url.trim())
			.filter(Boolean)
			.map((url) => ({ url, noindex: noindex.has(url) })),
		redirect: domainRedirect(application?.redirect),
		forceHttps: booleanValue(
			settings?.is_force_https_enabled ?? application?.is_force_https_enabled
		)
	};
}

function domainValidationError(value: string): string | undefined {
	if (/[`$;&|<>()\\\r\n]/.test(value) || value.includes(',')) {
		return 'The domain URL contains unsupported characters.';
	}
	try {
		const parsed = new URL(value);
		if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
			return 'Use an absolute http:// or https:// URL.';
		}
		if (parsed.username || parsed.password) return 'Credentials are not allowed in a domain URL.';
		const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
		if (!hostname.includes('.') && isIP(hostname) === 0) {
			return 'The hostname must be a fully qualified domain name or IP address.';
		}
		return undefined;
	} catch {
		return 'Use an absolute http:// or https:// URL.';
	}
}

export function applicationDomainSubmission(form: FormData): ApplicationDomainSubmission {
	const noindexIndexes = new Set(
		form
			.getAll('noindex_index')
			.map((value) => Number(value))
			.filter(Number.isInteger)
	);
	const rows = form
		.getAll('domain')
		.map((value, index) => ({ url: String(value).trim(), noindex: noindexIndexes.has(index) }))
		.filter((row) => row.url !== '');
	const redirect = domainRedirect(form.get('redirect'));
	const forceHttps = booleanValue(form.get('is_force_https_enabled'));
	const rowErrors: Record<number, string> = {};
	const seen = new Set<string>();

	rows.forEach((row, index) => {
		const validationError = domainValidationError(row.url);
		if (validationError) {
			rowErrors[index] = validationError;
			return;
		}
		if (seen.has(row.url)) rowErrors[index] = 'This domain is already listed.';
		seen.add(row.url);
	});

	if (Object.keys(rowErrors).length > 0) {
		return { rows, redirect, forceHttps, rowErrors };
	}

	const body: NonNullable<ApplicationDomainSubmission['body']> = {
		domains: rows.map((row) => row.url).join(','),
		noindex_domains: rows.filter((row) => row.noindex).map((row) => row.url),
		redirect: redirect || null,
		is_force_https_enabled: forceHttps
	};
	if (booleanValue(form.get('force_domain_override'))) body.force_domain_override = true;
	return { body, rows, redirect, forceHttps, rowErrors };
}

function firstError(value: unknown): string | undefined {
	const candidate = Array.isArray(value) ? value[0] : value;
	return candidate === undefined ? undefined : String(candidate);
}

export function applicationDomainFailure(caught: unknown): ApplicationDomainFailure {
	const details = caught instanceof CoolifyError ? record(caught.details) : undefined;
	const errors = record(details?.errors);
	const conflicts = Array.isArray(details?.conflicts)
		? details.conflicts
				.map(record)
				.filter((conflict) => conflict !== undefined)
				.map((conflict) => ({
					domain: String(conflict.domain ?? ''),
					resourceName: String(conflict.resource_name ?? ''),
					resourceUuid: String(conflict.resource_uuid ?? ''),
					resourceType: String(conflict.resource_type ?? ''),
					message: String(conflict.message ?? '')
				}))
		: [];
	return {
		error: caught instanceof Error ? caught.message : 'Coolify request failed',
		fieldError: firstError(errors?.domains),
		warning: typeof details?.warning === 'string' ? details.warning : undefined,
		conflicts
	};
}

function lastFormValue(form: FormData, name: string): string {
	const values = form.getAll(name);
	return String(values.at(-1) ?? '');
}

function encodeBase64(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64');
}

export function configurationSubmission(
	form: FormData,
	fields: ReadonlyArray<ConfigurationField>
): ConfigurationSubmission {
	const body: Record<string, unknown> = {};
	const values: Record<string, string | boolean> = {};
	const sensitiveValues: string[] = [];
	const fieldErrors: Record<string, string> = {};

	for (const field of fields) {
		if (!form.has(field.name)) continue;
		const submitted = lastFormValue(form, field.name);
		const value = field.sensitive ? submitted : submitted.trim();

		if (field.sensitive) {
			if (value) sensitiveValues.push(value);
		} else if (field.coerce === 'boolean') {
			values[field.name] = ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
		} else {
			values[field.name] = value;
		}
		if (field.sensitive && value === '') continue;

		if (field.coerce === 'boolean') {
			body[field.name] = ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
		} else if (field.coerce === 'integer') {
			if (value === '' && field.nullable) {
				body[field.name] = null;
			} else if (!/^-?\d+$/.test(value)) {
				fieldErrors[field.name] = 'Enter a whole number.';
			} else {
				const number = Number(value);
				if (field.min !== undefined && number < field.min) {
					fieldErrors[field.name] = `Must be at least ${field.min}.`;
				} else if (field.max !== undefined && number > field.max) {
					fieldErrors[field.name] = `Must be at most ${field.max}.`;
				} else {
					body[field.name] = number;
				}
			}
		} else if (field.coerce === 'base64') {
			body[field.name] = encodeBase64(value);
		} else if (field.coerce === 'json') {
			if (value === '' && field.nullable) {
				body[field.name] = null;
			} else {
				try {
					body[field.name] = JSON.parse(value);
				} catch {
					fieldErrors[field.name] = 'Enter valid JSON.';
				}
			}
		} else {
			body[field.name] = value;
		}
	}

	return { body, values, sensitiveValues, fieldErrors };
}

function redactValues(value: string, sensitiveValues: readonly string[]): string {
	return sensitiveValues
		.filter(Boolean)
		.reduce((message, sensitive) => message.replaceAll(sensitive, '[REDACTED]'), value);
}

export function configurationFailure(
	caught: unknown,
	fields: ReadonlyArray<ConfigurationField>,
	sensitiveValues: readonly string[]
): { error: string; fieldErrors: Record<string, string> } {
	const allowed = new Map(fields.map((field) => [field.name, field]));
	const fieldErrors: Record<string, string> = {};
	const details =
		caught instanceof CoolifyError && caught.details && typeof caught.details === 'object'
			? (caught.details as Record<string, unknown>)
			: undefined;
	const errors =
		details?.errors && typeof details.errors === 'object'
			? (details.errors as Record<string, unknown>)
			: {};

	for (const [name, rawError] of Object.entries(errors)) {
		const field = allowed.get(name);
		if (!field) continue;
		const first = Array.isArray(rawError) ? rawError[0] : rawError;
		fieldErrors[name] = field.sensitive
			? 'Invalid value'
			: redactValues(String(first ?? 'Invalid value'), sensitiveValues);
	}

	const message = caught instanceof Error ? caught.message : 'Coolify request failed';
	return { error: redactValues(message, sensitiveValues), fieldErrors };
}

const DATABASE_ENGINES = new Set([
	'postgresql',
	'clickhouse',
	'dragonfly',
	'redis',
	'keydb',
	'mariadb',
	'mysql',
	'mongodb'
]);

function nonEmpty(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== '' && value !== undefined)
	);
}

export function newResourceRequest(input: NewResourceInput): {
	group: 'applications' | 'services' | 'databases';
	request: ContextualRequest;
} {
	const common = {
		project_uuid: input.projectUuid,
		server_uuid: input.serverUuid,
		environment_name: input.environmentName,
		environment_uuid: input.environmentUuid,
		destination_uuid: input.destinationUuid,
		name: input.name,
		description: input.description,
		instant_deploy: input.instantDeploy
	};
	let group: 'applications' | 'services' | 'databases';
	let endpointId: string;
	let specific: Record<string, unknown>;

	if (input.kind === 'public-repository') {
		group = 'applications';
		endpointId = 'POST:/applications/public';
		specific = {
			git_repository: input.fields.git_repository,
			git_branch: input.fields.git_branch,
			build_pack: input.fields.build_pack,
			ports_exposes: input.fields.ports_exposes,
			domains: input.fields.domains
		};
	} else if (input.kind === 'private-deploy-key') {
		group = 'applications';
		endpointId = 'POST:/applications/private-deploy-key';
		specific = {
			private_key_uuid: input.fields.private_key_uuid,
			git_repository: input.fields.git_repository,
			git_branch: input.fields.git_branch,
			build_pack: input.fields.build_pack,
			ports_exposes: input.fields.ports_exposes,
			domains: input.fields.domains
		};
	} else if (input.kind === 'github-app') {
		group = 'applications';
		endpointId = 'POST:/applications/private-github-app';
		specific = {
			github_app_uuid: input.fields.github_app_uuid,
			git_repository: input.fields.git_repository,
			git_branch: input.fields.git_branch,
			build_pack: input.fields.build_pack,
			ports_exposes: input.fields.ports_exposes,
			domains: input.fields.domains
		};
	} else if (input.kind === 'dockerfile') {
		group = 'applications';
		endpointId = 'POST:/applications/dockerfile';
		specific = { dockerfile: input.fields.dockerfile };
	} else if (input.kind === 'docker-compose') {
		group = 'services';
		endpointId = 'POST:/services';
		specific = { docker_compose_raw: input.fields.docker_compose_raw };
	} else if (input.kind === 'docker-image') {
		group = 'applications';
		endpointId = 'POST:/applications/dockerimage';
		specific = {
			docker_registry_image_name: input.fields.docker_registry_image_name,
			docker_registry_image_tag: input.fields.docker_registry_image_tag,
			ports_exposes: input.fields.ports_exposes,
			domains: input.fields.domains
		};
	} else if (input.kind === 'service') {
		group = 'services';
		endpointId = 'POST:/services';
		specific = {
			type: input.fields.type,
			docker_compose_raw: input.fields.docker_compose_raw
		};
	} else {
		const engine = input.fields.engine;
		if (!DATABASE_ENGINES.has(engine)) throw new Error('Unsupported database engine');
		group = 'databases';
		endpointId = `POST:/databases/${engine}`;
		specific = {
			image: input.fields.image,
			is_public: input.fields.is_public === 'true',
			public_port: input.fields.public_port ? Number(input.fields.public_port) : undefined
		};
	}

	const endpoint = getEndpoint(endpointId);
	return {
		group,
		request: buildEndpointRequest(endpoint, {}, { body: nonEmpty({ ...common, ...specific }) })
	};
}
