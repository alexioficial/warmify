import type { CoolifyMethod, CoolifyRequestOptions } from './coolify-client';

export type EndpointRisk = 'read' | 'write' | 'confirm' | 'delete';

export interface EndpointDefinition {
	id: string;
	group: string;
	method: CoolifyMethod;
	path: string;
	pathParameters: string[];
	risk: EndpointRisk;
	sensitive: boolean;
}

const DOCUMENTED_ENDPOINTS: ReadonlyArray<readonly [string, string]> = [
	[
		'applications',
		`GET /applications
POST /applications/public
POST /applications/private-github-app
POST /applications/private-deploy-key
POST /applications/dockerfile
POST /applications/dockerimage
GET /applications/{uuid}
DELETE /applications/{uuid}
PATCH /applications/{uuid}
GET /applications/{uuid}/logs
GET /applications/{uuid}/envs
POST /applications/{uuid}/envs
PATCH /applications/{uuid}/envs
PATCH /applications/{uuid}/envs/bulk
DELETE /applications/{uuid}/envs/{env_uuid}
POST /applications/{uuid}/start
POST /applications/{uuid}/stop
POST /applications/{uuid}/restart
POST /applications/{uuid}/move
POST /applications/{uuid}/migrate
GET /applications/{uuid}/storages
POST /applications/{uuid}/storages
PATCH /applications/{uuid}/storages
DELETE /applications/{uuid}/storages/{storage_uuid}
DELETE /applications/{uuid}/previews/{pull_request_id}
GET /applications/{uuid}/tags
POST /applications/{uuid}/tags
DELETE /applications/{uuid}/tags/{tag_uuid}
POST /applications/{uuid}/clone
GET /applications/{uuid}/rollback-images
POST /applications/{uuid}/rollback
GET /applications/{uuid}/destinations
POST /applications/{uuid}/destinations
DELETE /applications/{uuid}/destinations/{destination_uuid}
GET /applications/{uuid}/scheduled-tasks
POST /applications/{uuid}/scheduled-tasks
DELETE /applications/{uuid}/scheduled-tasks/{task_uuid}
PATCH /applications/{uuid}/scheduled-tasks/{task_uuid}
GET /applications/{uuid}/scheduled-tasks/{task_uuid}/executions
POST /applications/{uuid}/scheduled-tasks/{task_uuid}/execute
PUT /applications/{uuid}/storages/{storage_uuid}/backups
DELETE /applications/{uuid}/storages/{storage_uuid}/backups
POST /applications/{uuid}/storages/{storage_uuid}/backups/run`
	],
	[
		'cloud',
		`GET /cloud-init-scripts
POST /cloud-init-scripts
GET /cloud-init-scripts/{uuid}
DELETE /cloud-init-scripts/{uuid}
PATCH /cloud-init-scripts/{uuid}
GET /cloud-tokens
POST /cloud-tokens
GET /cloud-tokens/{uuid}
DELETE /cloud-tokens/{uuid}
PATCH /cloud-tokens/{uuid}
POST /cloud-tokens/{uuid}/validate
GET /digitalocean/regions
GET /digitalocean/sizes
GET /digitalocean/images
GET /digitalocean/ssh-keys
POST /servers/digitalocean
GET /hetzner/locations
GET /hetzner/server-types
GET /hetzner/images
GET /hetzner/ssh-keys
GET /hetzner/firewalls
GET /hetzner/networks
POST /servers/hetzner
GET /vultr/regions
GET /vultr/plans
GET /vultr/os
GET /vultr/ssh-keys
POST /servers/vultr`
	],
	[
		'databases',
		`GET /databases
GET /databases/{uuid}/backups
POST /databases/{uuid}/backups
GET /databases/{uuid}
DELETE /databases/{uuid}
PATCH /databases/{uuid}
DELETE /databases/{uuid}/backups/{scheduled_backup_uuid}
PATCH /databases/{uuid}/backups/{scheduled_backup_uuid}
POST /databases/postgresql
POST /databases/clickhouse
POST /databases/dragonfly
POST /databases/redis
POST /databases/keydb
POST /databases/mariadb
POST /databases/mysql
POST /databases/mongodb
GET /databases/{uuid}/logs
DELETE /databases/{uuid}/backups/{scheduled_backup_uuid}/executions/{execution_uuid}
GET /databases/{uuid}/backups/{scheduled_backup_uuid}/executions
POST /databases/{uuid}/move
POST /databases/{uuid}/migrate
POST /databases/{uuid}/start
POST /databases/{uuid}/stop
POST /databases/{uuid}/restart
GET /databases/{uuid}/envs
POST /databases/{uuid}/envs
PATCH /databases/{uuid}/envs
PATCH /databases/{uuid}/envs/bulk
DELETE /databases/{uuid}/envs/{env_uuid}
GET /databases/{uuid}/storages
POST /databases/{uuid}/storages
PATCH /databases/{uuid}/storages
DELETE /databases/{uuid}/storages/{storage_uuid}
PUT /databases/{uuid}/storages/{storage_uuid}/backups
GET /databases/{uuid}/tags
POST /databases/{uuid}/tags
DELETE /databases/{uuid}/tags/{tag_uuid}
POST /databases/{uuid}/clone
DELETE /databases/{uuid}/storages/{storage_uuid}/backups
POST /databases/{uuid}/storages/{storage_uuid}/backups/run`
	],
	[
		'deployments',
		`GET /deployments
GET /deployments/{uuid}
POST /deployments/{uuid}/cancel
POST /deploy
GET /deployments/applications/{uuid}`
	],
	[
		'destinations',
		`GET /destinations
GET /servers/{server_uuid}/destinations
POST /servers/{server_uuid}/destinations
GET /destinations/{uuid}
DELETE /destinations/{uuid}
PATCH /destinations/{uuid}`
	],
	[
		'sources',
		`GET /github-apps
POST /github-apps
GET /github-apps/{github_app_id}/repositories
GET /github-apps/{github_app_id}/repositories/{owner}/{repo}/branches
DELETE /github-apps/{github_app_id}
PATCH /github-apps/{github_app_id}
GET /gitlab-apps
POST /gitlab-apps
DELETE /gitlab-apps/{gitlab_app_id}
PATCH /gitlab-apps/{gitlab_app_id}`
	],
	[
		'notifications',
		`GET /notifications/email
PATCH /notifications/email
GET /notifications/discord
PATCH /notifications/discord
GET /notifications/slack
PATCH /notifications/slack
GET /notifications/telegram
PATCH /notifications/telegram
GET /notifications/pushover
PATCH /notifications/pushover
GET /notifications/webhook
PATCH /notifications/webhook`
	],
	[
		'system',
		`GET /version
POST /enable
POST /disable
POST /mcp/enable
POST /mcp/disable
GET /health`
	],
	[
		'projects',
		`GET /projects
POST /projects
GET /projects/{uuid}
DELETE /projects/{uuid}
PATCH /projects/{uuid}
GET /projects/{uuid}/{environment_name_or_uuid}
GET /projects/{uuid}/environments
POST /projects/{uuid}/environments
DELETE /projects/{uuid}/environments/{environment_name_or_uuid}
PATCH /projects/{uuid}/environments/{environment_name_or_uuid}
GET /projects/{uuid}/envs
POST /projects/{uuid}/envs
DELETE /projects/{uuid}/envs/{env_id}
PATCH /projects/{uuid}/envs/{env_id}
GET /projects/{uuid}/environments/{environment_name_or_uuid}/envs
POST /projects/{uuid}/environments/{environment_name_or_uuid}/envs
DELETE /projects/{uuid}/environments/{environment_name_or_uuid}/envs/{env_id}
PATCH /projects/{uuid}/environments/{environment_name_or_uuid}/envs/{env_id}`
	],
	[
		'resources',
		`GET /resources
GET /tags
POST /tags
DELETE /tags/{uuid}
PATCH /tags/{uuid}`
	],
	[
		'storage',
		`GET /s3-storages
POST /s3-storages
GET /s3-storages/{uuid}
DELETE /s3-storages/{uuid}
PATCH /s3-storages/{uuid}
POST /s3-storages/{uuid}/validate`
	],
	[
		'security',
		`GET /security/keys
POST /security/keys
PATCH /security/keys
GET /security/keys/{uuid}
DELETE /security/keys/{uuid}`
	],
	[
		'servers',
		`GET /servers/{uuid}/cloudflare-tunnel
PATCH /servers/{uuid}/cloudflare-tunnel
POST /servers/{uuid}/cloudflare-tunnel/enable
POST /servers/{uuid}/cloudflare-tunnel/disable
GET /servers/{uuid}/docker-cleanup
PATCH /servers/{uuid}/docker-cleanup
POST /servers/{uuid}/docker-cleanup/run
GET /servers/{uuid}/docker-cleanup/executions
GET /servers/{uuid}/log-drains
PATCH /servers/{uuid}/log-drains
GET /servers/{uuid}/proxy
PATCH /servers/{uuid}/proxy
POST /servers/{uuid}/proxy/restart
GET /servers/{uuid}/sentinel
PATCH /servers/{uuid}/sentinel
POST /servers/{uuid}/migrate
GET /servers/{uuid}/export
POST /servers/import
POST /servers/{uuid}/claim
POST /servers/{uuid}/transfer/complete
POST /servers/{uuid}/export/mailbox
GET /servers
POST /servers
GET /servers/{uuid}
DELETE /servers/{uuid}
PATCH /servers/{uuid}
GET /servers/{uuid}/resources
GET /servers/{uuid}/domains
POST /servers/{uuid}/validate
GET /servers/{uuid}/envs
POST /servers/{uuid}/envs
DELETE /servers/{uuid}/envs/{env_id}
PATCH /servers/{uuid}/envs/{env_id}`
	],
	[
		'services',
		`GET /services/{uuid}/applications
GET /services/{uuid}/applications/{app_uuid}
PATCH /services/{uuid}/applications/{app_uuid}
GET /services/{uuid}/applications/{app_uuid}/logs
POST /services/{uuid}/applications/{app_uuid}/logs
POST /services/{uuid}/applications/{app_uuid}/start
POST /services/{uuid}/applications/{app_uuid}/restart
POST /services/{uuid}/applications/{app_uuid}/stop
GET /services/{uuid}/databases
GET /services/{uuid}/databases/{database_uuid}
PATCH /services/{uuid}/databases/{database_uuid}
GET /services/{uuid}/databases/{database_uuid}/logs
POST /services/{uuid}/databases/{database_uuid}/start
POST /services/{uuid}/databases/{database_uuid}/restart
POST /services/{uuid}/databases/{database_uuid}/stop
GET /services
POST /services
GET /services/{uuid}
DELETE /services/{uuid}
PATCH /services/{uuid}
GET /services/{uuid}/logs
GET /services/{uuid}/envs
POST /services/{uuid}/envs
PATCH /services/{uuid}/envs
PATCH /services/{uuid}/envs/bulk
DELETE /services/{uuid}/envs/{env_uuid}
POST /services/{uuid}/move
POST /services/{uuid}/migrate
POST /services/{uuid}/start
POST /services/{uuid}/stop
POST /services/{uuid}/restart
GET /services/{uuid}/storages
POST /services/{uuid}/storages
PATCH /services/{uuid}/storages
DELETE /services/{uuid}/storages/{storage_uuid}
GET /services/{uuid}/tags
POST /services/{uuid}/tags
DELETE /services/{uuid}/tags/{tag_uuid}
POST /services/{uuid}/clone
GET /services/{uuid}/scheduled-tasks
POST /services/{uuid}/scheduled-tasks
DELETE /services/{uuid}/scheduled-tasks/{task_uuid}
PATCH /services/{uuid}/scheduled-tasks/{task_uuid}
GET /services/{uuid}/scheduled-tasks/{task_uuid}/executions
POST /services/{uuid}/scheduled-tasks/{task_uuid}/execute
PUT /services/{uuid}/storages/{storage_uuid}/backups
DELETE /services/{uuid}/storages/{storage_uuid}/backups
POST /services/{uuid}/storages/{storage_uuid}/backups/run`
	],
	[
		'teams',
		`GET /team/envs
POST /team/envs
DELETE /team/envs/{env_id}
PATCH /team/envs/{env_id}
GET /teams
GET /teams/{id}
GET /teams/{id}/members
GET /team
GET /team/members`
	]
];

function classifyRisk(method: CoolifyMethod, path: string): EndpointRisk {
	if (method === 'GET') return 'read';
	if (method === 'DELETE') return 'delete';
	if (
		/(?:\/stop|\/restart|\/cancel|\/disable|\/migrate|\/move|\/rollback|\/claim|\/transfer|backups\/run)$/.test(
			path
		)
	)
		return 'confirm';
	return 'write';
}

function isSensitive(path: string): boolean {
	return /(?:envs|keys|tokens|notifications|cloudflare-tunnel)/.test(path);
}

export const endpointManifest: EndpointDefinition[] = DOCUMENTED_ENDPOINTS.flatMap(
	([group, definitions]) =>
		definitions
			.trim()
			.split('\n')
			.map((definition) => {
				const separator = definition.indexOf(' ');
				const method = definition.slice(0, separator) as CoolifyMethod;
				const path = definition.slice(separator + 1);
				return {
					id: `${method}:${path}`,
					group,
					method,
					path,
					pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
					risk: classifyRisk(method, path),
					sensitive: isSensitive(path)
				};
			})
);

const endpointById = new Map(endpointManifest.map((endpoint) => [endpoint.id, endpoint]));

export function getEndpoint(id: string): EndpointDefinition {
	const endpoint = endpointById.get(id);
	if (!endpoint) throw new Error(`Coolify operation is not allowlisted: ${id}`);
	return endpoint;
}

export function buildEndpointRequest(
	endpoint: EndpointDefinition,
	parameters: Record<string, string>,
	options: CoolifyRequestOptions = {}
): { method: CoolifyMethod; path: string; options?: CoolifyRequestOptions } {
	let path = endpoint.path;
	for (const name of endpoint.pathParameters) {
		const value = parameters[name]?.trim();
		if (!value) throw new Error(`Missing path parameter: ${name}`);
		path = path.replace(`{${name}}`, encodeURIComponent(value));
	}
	const hasOptions =
		options.body !== undefined || (options.query && Object.keys(options.query).length > 0);
	return hasOptions
		? { method: endpoint.method, path, options }
		: { method: endpoint.method, path };
}
