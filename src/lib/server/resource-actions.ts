import type { CoolifyMethod, CoolifyRequestOptions } from './coolify-client';
import { buildEndpointRequest, getEndpoint } from './endpoint-manifest';

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
