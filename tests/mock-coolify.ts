import { mockServices } from './mock-services';
import { mockDockerCreation } from './mock-docker-creation';
import { mockGitCreation } from './mock-git-creation';
import { mockTemplateCreation } from './mock-template-creation';
import { mockDatabases } from './mock-databases';
import { mockProjects } from './mock-projects';
import { mockDeployments } from './mock-deployments';

const server = {
	id: 1,
	uuid: 'server-1',
	name: 'Primary server',
	description: 'Main deployment host',
	ip: '10.0.0.1',
	port: 22,
	user: 'root',
	is_coolify_host: false,
	status: 'running',
	proxy: { type: 'TRAEFIK', secret: 'server-proxy-fixture-secret' },
	settings: {
		is_reachable: true,
		is_usable: true,
		is_build_server: false,
		concurrent_builds: 2,
		sentinel_token: 'server-sentinel-fixture-secret'
	}
};
const servers: Array<Record<string, unknown>> = [server];
let createdServer: Record<string, unknown> | undefined;
const serverSharedVariables = [
	{
		id: 1,
		key: 'SERVER_REGION',
		value: 'server-shared-fixture-secret',
		comment: 'Shared by resources on this server',
		is_literal: false,
		is_multiline: false,
		is_shown_once: false
	}
];
let serverDockerCleanup = {
	docker_cleanup_frequency: '0 3 * * *',
	docker_cleanup_threshold: 80,
	force_docker_cleanup: false,
	delete_unused_volumes: true,
	delete_unused_networks: false,
	disable_application_image_retention: false
};
const serverDockerCleanupExecutions = [
	{
		uuid: 'cleanup-1',
		status: 'success',
		message: 'Removed unused Docker images.',
		created_at: '2026-09-04T12:00:00Z',
		finished_at: '2026-09-04T12:00:04Z',
		secret: 'cleanup-execution-fixture-secret'
	}
];
let serverProxy = {
	proxy_type: 'TRAEFIK',
	status: 'running',
	redirect_enabled: true,
	redirect_url: 'https://redirect.example.com',
	generate_exact_labels: false,
	configuration: 'services:\n  proxy:\n    environment:\n      TOKEN: proxy-config-fixture-secret'
};
let serverTunnel = {
	is_cloudflare_tunnel: false,
	ip: '10.0.0.1',
	ip_previous: '198.51.100.8'
};
let serverSentinel: Record<string, unknown> = {
	is_sentinel_enabled: true,
	is_metrics_enabled: true,
	is_sentinel_debug_enabled: false,
	sentinel_metrics_refresh_rate_seconds: 10,
	sentinel_metrics_history_days: 7,
	sentinel_push_interval_seconds: 30,
	sentinel_updated_at: '2026-09-04T12:00:00Z',
	sentinel_token: 'sentinel-api-fixture-secret',
	sentinel_custom_url: 'https://sentinel.example.com/private'
};
let serverLogDrains: Record<string, unknown> = {
	is_logdrain_newrelic_enabled: true,
	logdrain_newrelic_license_key: 'newrelic-fixture-secret',
	logdrain_newrelic_base_uri: 'https://log-api.newrelic.com',
	is_logdrain_axiom_enabled: true,
	logdrain_axiom_dataset_name: 'production',
	logdrain_axiom_api_key: 'axiom-fixture-secret',
	is_logdrain_custom_enabled: false,
	logdrain_custom_config: '[OUTPUT]\nName http\nHeader token custom-config-fixture-secret',
	logdrain_custom_config_parser: '[PARSER]\nName json'
};
const deployments = [
	{
		deployment_uuid: 'deploy-1',
		application_name: 'wiki',
		status: 'in_progress',
		commit_message: 'Update documentation',
		created_at: '2026-08-26T01:00:00Z',
		environment: { name: 'production' },
		server: { name: 'Primary server' }
	}
];
const applicationDeployments = [
	{
		deployment_uuid: 'app-deploy-active',
		application_name: 'Image App',
		status: 'in_progress',
		commit: '1234567890abcdef',
		commit_message: 'Deploy the current image',
		created_at: '2026-08-30T12:00:00Z',
		server_name: 'Primary server',
		is_api: true
	},
	{
		deployment_uuid: 'app-deploy-queued',
		application_name: 'Image App',
		status: 'queued',
		commit: 'abcdef1234567890',
		commit_message: 'Queued deployment',
		created_at: '2026-08-30T12:01:00Z',
		server_name: 'Primary server',
		is_webhook: true
	},
	{
		deployment_uuid: 'app-deploy-finished',
		application_name: 'Image App',
		status: 'finished',
		commit: 'fedcba0987654321',
		commit_message: 'Previous successful deployment',
		created_at: '2026-08-30T11:00:00Z',
		finished_at: '2026-08-30T11:00:42Z',
		server_name: 'Primary server'
	}
];
let applicationDeploymentReads = 0;
const failedLogTails = new Set<number>();
let application: Record<string, unknown> = {
	uuid: 'app-2',
	environment_id: 1,
	name: 'Image App',
	description: 'Created from Docker image',
	status: 'running:healthy',
	fqdn: 'https://image.example.com,http://preview.image.example.com/path',
	noindex_domains: ['http://preview.image.example.com/path'],
	redirect: 'non-www',
	build_pack: 'dockerimage',
	docker_registry_image_name: 'nginx',
	docker_registry_image_tag: 'latest',
	custom_docker_run_options: '--memory 512m',
	max_restart_count: 3,
	stop_grace_period: 30,
	is_consistent_container_name_enabled: false,
	ports_exposes: '80,443',
	ports_mappings: '8080:80',
	custom_network_aliases: 'image-app,web',
	http_basic_auth_password: 'root-password-secret',
	settings: { is_force_https_enabled: true },
	destination: { network: 'coolify' },
	environment: { name: 'production' },
	server: { name: 'Primary server' }
};
let gitApplication: Record<string, unknown> = {
	uuid: 'app-1',
	environment_id: 1,
	name: 'Website',
	status: 'running:healthy',
	fqdn: 'https://example.com',
	git_repository: 'widube/website',
	git_branch: 'main',
	git_commit_sha: '',
	build_pack: 'railpack',
	environment: { name: 'production' },
	server: { name: 'Primary server' }
};
let clonedApplication: Record<string, unknown> | undefined;
let deletableApplicationExists = true;
let environmentVariableSequence = 2;
let applicationVariables: Array<Record<string, unknown>> = [
	{
		uuid: 'env-1',
		key: 'DATABASE_URL',
		value: 'postgres://production-secret',
		real_value: 'postgres://production-secret',
		comment: 'Primary database',
		is_preview: false,
		is_literal: false,
		is_multiline: false,
		is_shown_once: false,
		is_runtime: true,
		is_buildtime: true
	}
];
let storageSequence = 3;
let applicationStorages: {
	persistent_storages: Array<Record<string, unknown>>;
	file_storages: Array<Record<string, unknown>>;
} = {
	persistent_storages: [
		{
			uuid: 'storage-1',
			name: 'app-2-data',
			mount_path: '/data',
			host_path: null,
			is_preview_suffix_enabled: true
		}
	],
	file_storages: [
		{
			uuid: 'storage-2',
			mount_path: '/app/config.json',
			fs_path: '/data/coolify/applications/app-2/config.json',
			content: '{"private":"mock-secret-content"}',
			is_directory: false,
			is_host_file: false,
			is_preview_suffix_enabled: true
		}
	]
};
const storageBackupSchedules = new Map<string, Record<string, unknown>>();
let scheduledTaskSequence = 2;
let scheduledTaskExecutionSequence = 2;
let scheduledTasks: Array<Record<string, unknown>> = [
	{
		uuid: 'task-1',
		name: 'Cleanup',
		command: 'php artisan cache:clear',
		frequency: '0 2 * * *',
		container: null,
		timeout: 300,
		enabled: true
	}
];
const scheduledTaskExecutions = new Map<string, Array<Record<string, unknown>>>([
	[
		'task-1',
		[
			{
				uuid: 'task-execution-1',
				status: 'success',
				message: 'Cleanup complete',
				retry_count: 0,
				duration: 1.25,
				started_at: '2026-08-30T11:00:00Z',
				finished_at: '2026-08-30T11:00:01Z',
				created_at: '2026-08-30T11:00:00Z'
			}
		]
	]
]);
let allDestinations = [
	{
		uuid: 'destination-1',
		name: 'Primary destination',
		network: 'coolify',
		type: 'standalone',
		server_uuid: 'server-1',
		created_at: '2026-08-30T12:00:00Z',
		updated_at: '2026-08-30T12:00:00Z'
	},
	{
		uuid: 'destination-2',
		name: 'Secondary destination',
		network: 'coolify-secondary',
		type: 'standalone',
		server_uuid: 'server-2',
		created_at: '2026-08-30T12:00:00Z',
		updated_at: '2026-08-30T12:00:00Z'
	}
];
let destinationSequence = 3;
let applicationDestinations: Array<Record<string, unknown>> = [
	{
		uuid: 'destination-1',
		name: 'Primary destination',
		network: 'coolify',
		server_uuid: 'server-1',
		is_primary: true
	}
];
let applicationTags: Array<Record<string, unknown>> = [{ uuid: 'tag-1', name: 'production' }];
let tagSequence = 2;
const rollbackImages = {
	current: 'current-sha',
	images: [
		{ tag: 'current-sha', created_at: '2026-08-30T12:00:00Z', is_current: true },
		{ tag: 'previous-sha', created_at: '2026-08-29T12:00:00Z', is_current: false }
	]
};
const githubApps: Array<Record<string, unknown>> = [
	{
		id: 7,
		uuid: 'github-app-1',
		name: 'widube',
		organization: 'widube',
		api_url: 'https://api.github.com',
		html_url: 'https://github.com',
		custom_user: 'git',
		custom_port: 22,
		app_id: 101,
		installation_id: 202,
		client_id: 'github-client',
		private_key_id: 3,
		is_system_wide: false,
		is_public: false,
		team_id: 1,
		client_secret: 'github-list-fixture-secret',
		webhook_secret: 'github-webhook-fixture-secret'
	}
];
const gitlabApps: Array<Record<string, unknown>> = [
	{
		id: 8,
		uuid: 'gitlab-app-1',
		name: 'Internal GitLab',
		api_url: 'https://gitlab.example.com/api/v4',
		html_url: 'https://gitlab.example.com',
		custom_user: 'git',
		custom_port: 22,
		client_id: 'gitlab-client',
		group_name: 'platform',
		redirect_uri: 'https://coolify.example.com/webhooks/source/gitlab/redirect',
		is_system_wide: false,
		is_public: false,
		team_id: 1,
		client_secret: 'gitlab-list-fixture-secret',
		webhook_token: 'gitlab-webhook-fixture-secret',
		access_token: 'gitlab-access-fixture-secret'
	}
];
let sourceSequence = 20;
const s3Storages: Array<Record<string, unknown>> = [
	{
		uuid: 's3-1',
		name: 'Primary backups',
		description: 'Production archives',
		endpoint: 'https://s3.example.com',
		bucket: 'production-backups',
		region: 'us-east-1',
		is_usable: true,
		team_id: 1,
		created_at: '2026-09-04T00:00:00Z',
		updated_at: '2026-09-04T00:00:00Z',
		key: 's3-access-list-fixture-secret',
		secret: 's3-secret-list-fixture-secret'
	}
];
let s3Sequence = 2;
const cloudTokens: Array<Record<string, unknown>> = [
	{
		uuid: 'cloud-token-1',
		name: 'Production Hetzner',
		provider: 'hetzner',
		team_id: 1,
		servers_count: 1,
		token: 'cloud-token-list-fixture-secret',
		created_at: '2026-09-04T00:00:00Z',
		updated_at: '2026-09-04T00:00:00Z'
	},
	{
		uuid: 'cloud-token-do',
		name: 'DigitalOcean test token',
		provider: 'digitalocean',
		team_id: 1,
		servers_count: 0,
		token: 'digitalocean-token-list-fixture-secret',
		created_at: '2026-09-04T00:00:00Z',
		updated_at: '2026-09-04T00:00:00Z'
	},
	{
		uuid: 'cloud-token-vultr',
		name: 'Vultr test token',
		provider: 'vultr',
		team_id: 1,
		servers_count: 0,
		token: 'vultr-token-list-fixture-secret',
		created_at: '2026-09-04T00:00:00Z',
		updated_at: '2026-09-04T00:00:00Z'
	}
];
let cloudTokenSequence = 2;
const cloudInitScripts: Array<Record<string, unknown>> = [
	{
		uuid: 'cloud-init-1',
		name: 'Docker bootstrap',
		script: '#!/bin/sh\necho cloud-init-list-fixture-secret',
		team_id: 1,
		created_at: '2026-09-04T00:00:00Z',
		updated_at: '2026-09-04T00:00:00Z'
	}
];
let cloudInitSequence = 2;
const team = {
	id: 1,
	name: 'Root Team',
	description: 'Primary deployment team',
	personal_team: false,
	created_at: '2026-09-01T00:00:00Z',
	updated_at: '2026-09-01T00:00:00Z'
};
const teamMembers = [
	{
		id: 1,
		name: 'Admin User',
		email: 'admin@example.com',
		email_verified_at: '2026-09-01T00:00:00Z',
		two_factor_confirmed_at: '2026-09-01T01:00:00Z',
		force_password_reset: false,
		created_at: '2026-09-01T00:00:00Z',
		password: 'team-member-password-fixture-secret'
	}
];
let teamSharedVariableSequence = 2;
let teamSharedVariables: Array<Record<string, unknown>> = [
	{
		id: 1,
		key: 'TEAM_REGION',
		value: 'team-shared-fixture-secret',
		comment: 'Inherited by team resources',
		is_literal: false,
		is_multiline: false,
		is_shown_once: false
	}
];
let privateKeySequence = 2;
let privateKeys: Array<Record<string, unknown>> = [
	{
		id: 3,
		uuid: 'key-1',
		name: 'Production SSH key',
		description: 'Mock team key',
		private_key: 'private-key-fixture-secret',
		public_key: 'ssh-ed25519 public-key-fixture',
		fingerprint: 'SHA256:fixture',
		is_git_related: true,
		created_at: '2026-09-01T00:00:00Z',
		updated_at: '2026-09-01T00:00:00Z'
	}
];
const notificationEventNames = [
	'deployment_success',
	'deployment_failure',
	'status_change',
	'backup_success',
	'backup_failure',
	'scheduled_task_success',
	'scheduled_task_failure',
	'docker_cleanup_success',
	'docker_cleanup_failure',
	'server_disk_usage',
	'server_reachable',
	'server_unreachable',
	'server_patch',
	'traefik_outdated'
];
const notificationAllowedFields: Record<string, string[]> = {
	email: [
		'smtp_enabled',
		'smtp_from_address',
		'smtp_from_name',
		'smtp_recipients',
		'smtp_host',
		'smtp_port',
		'smtp_encryption',
		'smtp_username',
		'smtp_password',
		'smtp_timeout',
		'smtp_ehlo_domain',
		'resend_enabled',
		'resend_api_key',
		'use_instance_email_settings',
		...notificationEventNames.map((event) => `${event}_email_notifications`)
	],
	discord: [
		'discord_enabled',
		'discord_webhook_url',
		'discord_ping_enabled',
		...notificationEventNames.map((event) => `${event}_discord_notifications`)
	],
	slack: [
		'slack_enabled',
		'slack_webhook_url',
		...notificationEventNames.map((event) => `${event}_slack_notifications`)
	],
	telegram: [
		'telegram_enabled',
		'telegram_token',
		'telegram_chat_id',
		...notificationEventNames.map((event) => `${event}_telegram_notifications`),
		...notificationEventNames.map((event) => `telegram_notifications_${event}_thread_id`)
	],
	pushover: [
		'pushover_enabled',
		'pushover_user_key',
		'pushover_api_token',
		...notificationEventNames.map((event) => `${event}_pushover_notifications`)
	],
	webhook: [
		'webhook_enabled',
		'webhook_url',
		...notificationEventNames.map((event) => `${event}_webhook_notifications`)
	]
};
const notificationSettings: Record<string, Record<string, unknown>> = {
	email: {
		smtp_enabled: true,
		smtp_from_address: 'alerts@example.com',
		smtp_host: 'smtp.notification-fixture-secret.example.com',
		smtp_password: 'smtp-notification-fixture-secret',
		smtp_port: 587,
		smtp_encryption: 'starttls',
		smtp_timeout: 30,
		deployment_failure_email_notifications: true
	},
	discord: {
		discord_enabled: false,
		discord_webhook_url: 'https://discord.com/api/webhooks/notification-fixture-secret',
		deployment_failure_discord_notifications: true
	},
	slack: {
		slack_enabled: false,
		slack_webhook_url: 'https://hooks.slack.com/notification-fixture-secret'
	},
	telegram: {
		telegram_enabled: false,
		telegram_token: 'telegram-notification-fixture-secret',
		telegram_chat_id: 'telegram-chat-fixture-secret',
		telegram_notifications_deployment_failure_thread_id: 'telegram-thread-fixture-secret'
	},
	pushover: {
		pushover_enabled: false,
		pushover_user_key: 'pushover-user-fixture-secret',
		pushover_api_token: 'pushover-token-fixture-secret'
	},
	webhook: {
		webhook_enabled: false,
		webhook_url: 'https://notifications.example.com/notification-fixture-secret'
	}
};

Bun.serve({
	port: 4010,
	async fetch(request: Request) {
		if (request.headers.get('Authorization') !== 'Bearer 1|e2e-secret')
			return Response.json({ message: 'Unauthenticated.' }, { status: 401 });
		const url = new URL(request.url);
		const deployResponse = await mockDeployments(request);
		if (deployResponse) return deployResponse;
		const templateResponse = await mockTemplateCreation(request);
		if (templateResponse) return templateResponse;
		const creationResponse = await mockDockerCreation(request);
		if (creationResponse) return creationResponse;
		const gitCreationResponse = await mockGitCreation(request);
		if (gitCreationResponse) return gitCreationResponse;
		const serviceResponse = await mockServices(request);
		if (serviceResponse) return serviceResponse;
		const databaseResponse = await mockDatabases(request);
		if (databaseResponse) return databaseResponse;
		const projectResponse = await mockProjects(request);
		if (projectResponse) return projectResponse;
		const responses: Record<string, unknown> = {
			'/api/v1/team': team,
			'/api/v1/servers': servers,
			'/api/v1/security/keys': privateKeys,
			'/api/v1/teams': [team],
			'/api/v1/destinations': allDestinations,
			'/api/v1/deployments': deployments,
			'/api/v1/version': { version: '4.2.0' },
			'/api/v1/resources': [{ uuid: 'app-1', environment_id: 1, type: 'application' }],
			'/api/v1/applications': [],
			'/api/v1/applications/app-2': application,
			'/api/v1/applications/app-1': gitApplication,
			'/api/v1/applications/app-2/envs': applicationVariables,
			'/api/v1/applications/app-2/storages': applicationStorages,
			'/api/v1/services': [],
			'/api/v1/databases': []
		};
		if (url.pathname === '/api/v1/health') return new Response('OK');
		const notificationMatch = url.pathname.match(
			/^\/api\/v1\/notifications\/(email|discord|slack|telegram|pushover|webhook)$/
		);
		if (notificationMatch) {
			const channel = notificationMatch[1];
			if (request.method === 'GET') return Response.json(notificationSettings[channel]);
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (Object.keys(body).some((key) => !notificationAllowedFields[channel].includes(key)))
					return Response.json({ message: 'Unexpected notification field.' }, { status: 422 });
				notificationSettings[channel] = { ...notificationSettings[channel], ...body };
				return Response.json({
					...notificationSettings[channel],
					response_secret: 'notification-update-response-fixture-secret'
				});
			}
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/teams/1') return Response.json(team);
		if (request.method === 'GET' && url.pathname === '/api/v1/teams/1/members')
			return Response.json(teamMembers);
		if (request.method === 'GET' && url.pathname === '/api/v1/team/envs')
			return Response.json(teamSharedVariables);
		if (request.method === 'POST' && url.pathname === '/api/v1/team/envs') {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).some(
					(key) =>
						!['key', 'value', 'comment', 'is_literal', 'is_multiline', 'is_shown_once'].includes(
							key
						)
				) ||
				typeof body.key !== 'string' ||
				teamSharedVariables.some((variable) => variable.key === body.key)
			)
				return Response.json({ message: 'Shared variable already exists.' }, { status: 409 });
			const variable = { id: teamSharedVariableSequence++, ...body };
			teamSharedVariables.push(variable);
			return Response.json(variable, { status: 201 });
		}
		const teamVariableMatch = url.pathname.match(/^\/api\/v1\/team\/envs\/([0-9]+)$/);
		if (teamVariableMatch) {
			const id = Number(teamVariableMatch[1]);
			const index = teamSharedVariables.findIndex((variable) => variable.id === id);
			if (index < 0)
				return Response.json({ message: 'Shared variable not found.' }, { status: 404 });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (
					Object.keys(body).some(
						(key) =>
							!['key', 'value', 'comment', 'is_literal', 'is_multiline', 'is_shown_once'].includes(
								key
							)
					)
				)
					return Response.json({ message: 'Unexpected shared-variable field.' }, { status: 422 });
				teamSharedVariables[index] = { ...teamSharedVariables[index], ...body };
				return Response.json(teamSharedVariables[index]);
			}
			if (request.method === 'DELETE') {
				teamSharedVariables = teamSharedVariables.filter((variable) => variable.id !== id);
				return Response.json({ message: 'Shared variable deleted.' });
			}
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/security/keys') {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).some((key) => !['name', 'description', 'private_key'].includes(key)) ||
				typeof body.private_key !== 'string' ||
				!body.private_key
			)
				return Response.json({ message: 'Invalid private key body.' }, { status: 422 });
			const key = {
				id: privateKeySequence + 2,
				uuid: `key-created-${privateKeySequence++}`,
				name: body.name || 'Private key',
				description: body.description || '',
				private_key: body.private_key,
				public_key: 'ssh-ed25519 created-public-key-fixture',
				fingerprint: 'SHA256:created',
				is_git_related: false,
				created_at: '2026-09-07T00:00:00Z',
				updated_at: '2026-09-07T00:00:00Z'
			};
			privateKeys.push(key);
			return Response.json({ uuid: key.uuid }, { status: 201 });
		}
		const privateKeyMatch = url.pathname.match(/^\/api\/v1\/security\/keys\/([^/]+)$/);
		if (privateKeyMatch) {
			const uuid = decodeURIComponent(privateKeyMatch[1]);
			const index = privateKeys.findIndex((key) => key.uuid === uuid);
			if (index < 0) return Response.json({ message: 'Private key not found.' }, { status: 404 });
			if (request.method === 'GET') return Response.json(privateKeys[index]);
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (
					Object.keys(body).some((key) => !['name', 'description', 'private_key'].includes(key)) ||
					typeof body.name !== 'string' ||
					typeof body.description !== 'string' ||
					typeof body.private_key !== 'string' ||
					!body.private_key
				)
					return Response.json({ message: 'Invalid private key update.' }, { status: 422 });
				privateKeys[index] = { ...privateKeys[index], ...body };
				return Response.json({ uuid, message: 'private-key-update-response-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				if (uuid === 'key-1')
					return Response.json({ message: 'Private key is in use.' }, { status: 422 });
				privateKeys = privateKeys.filter((key) => key.uuid !== uuid);
				return Response.json({ message: 'Private key deleted.' });
			}
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/deployments/applications/app-2') {
			applicationDeploymentReads += 1;
			const settled = applicationDeploymentReads >= 2;
			const currentDeployments = applicationDeployments.map((deployment) =>
				settled && ['in_progress', 'queued'].includes(deployment.status)
					? {
							...deployment,
							status: 'finished',
							finished_at: '2026-08-30T12:02:00Z'
						}
					: deployment
			);
			return Response.json({ count: currentDeployments.length, deployments: currentDeployments });
		}
		const deploymentDetailMatch = url.pathname.match(/^\/api\/v1\/deployments\/([^/]+)$/);
		if (request.method === 'GET' && deploymentDetailMatch) {
			const deployment = applicationDeployments.find(
				(candidate) => candidate.deployment_uuid === decodeURIComponent(deploymentDetailMatch[1])
			);
			return deployment
				? Response.json({ ...deployment, logs: 'Build complete' })
				: Response.json({ message: 'Deployment not found.' }, { status: 404 });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-2/logs') {
			const lines = Number(url.searchParams.get('lines')) || 100;
			if (lines === 50) await Bun.sleep(300);
			if ([250, 500].includes(lines) && !failedLogTails.has(lines)) {
				failedLogTails.add(lines);
				return lines === 250
					? Response.json(
							{ message: 'Runtime logs are rate limited.' },
							{ status: 429, headers: { 'Retry-After': '7' } }
						)
					: Response.json({ message: 'Runtime log service unavailable.' }, { status: 503 });
			}
			const timestamp =
				url.searchParams.get('show_timestamps') === 'true' ? '2026-08-30T12:00:00Z ' : '';
			return Response.json({
				logs: `${timestamp}Container started\n${timestamp}Listening on port 80\nTail: ${lines}`
			});
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/servers') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = [
				'name',
				'description',
				'ip',
				'port',
				'user',
				'private_key_uuid',
				'is_build_server',
				'instant_validate',
				'proxy_type'
			];
			if (
				Object.keys(body).some((key) => !allowed.includes(key)) ||
				typeof body.ip !== 'string' ||
				body.private_key_uuid !== 'key-1'
			)
				return Response.json({ message: 'Invalid server body.' }, { status: 422 });
			createdServer = {
				uuid: 'server-created',
				name: typeof body.name === 'string' ? body.name : 'Created server',
				description: typeof body.description === 'string' ? body.description : null,
				ip: body.ip,
				port: body.port ?? 22,
				user: body.user ?? 'root',
				proxy_type: String(body.proxy_type ?? 'traefik').toUpperCase(),
				settings: {
					is_reachable: body.instant_validate === true,
					is_usable: false,
					is_build_server: body.is_build_server === true
				}
			};
			const existing = servers.findIndex((candidate) => candidate.uuid === 'server-created');
			if (existing >= 0) servers.splice(existing, 1, createdServer);
			else servers.push(createdServer);
			return Response.json(
				{ uuid: 'server-created', private_key: 'created-server-fixture-secret' },
				{ status: 201 }
			);
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-created') {
			return createdServer
				? Response.json(createdServer)
				: Response.json({ message: 'Server not found.' }, { status: 404 });
		}
		if (request.method === 'DELETE' && url.pathname === '/api/v1/servers/server-created') {
			createdServer = undefined;
			const index = servers.findIndex((candidate) => candidate.uuid === 'server-created');
			if (index >= 0) servers.splice(index, 1);
			return Response.json({ message: 'Server deleted.' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/destinations') {
			return Response.json(
				allDestinations.filter((destination) => destination.server_uuid === 'server-1')
			);
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/servers/server-1/destinations') {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).some((key) => !['name', 'network'].includes(key)) ||
				typeof body.network !== 'string'
			)
				return Response.json({ message: 'Invalid destination body.' }, { status: 422 });
			if (
				allDestinations.some(
					(destination) =>
						destination.server_uuid === 'server-1' && destination.network === body.network
				)
			)
				return Response.json({ message: 'Destination already exists.' }, { status: 409 });
			const destination = {
				uuid: `destination-created-${destinationSequence++}`,
				name:
					typeof body.name === 'string' && body.name ? body.name : `Primary server-${body.network}`,
				network: body.network,
				type: 'standalone',
				server_uuid: 'server-1',
				created_at: '2026-09-04T12:00:00Z',
				updated_at: '2026-09-04T12:00:00Z'
			};
			allDestinations.push(destination);
			return Response.json(
				{ ...destination, secret: 'destination-create-fixture-secret' },
				{ status: 201 }
			);
		}
		const destinationMatch = url.pathname.match(/^\/api\/v1\/destinations\/([^/]+)$/);
		if (destinationMatch) {
			const uuid = decodeURIComponent(destinationMatch[1]);
			const destination = allDestinations.find((candidate) => candidate.uuid === uuid);
			if (!destination)
				return Response.json({ message: 'Destination not found.' }, { status: 404 });
			if (request.method === 'GET')
				return Response.json({ ...destination, secret: 'destination-detail-fixture-secret' });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (Object.keys(body).length !== 1 || typeof body.name !== 'string')
					return Response.json({ message: 'Invalid destination update.' }, { status: 422 });
				destination.name = body.name;
				destination.updated_at = '2026-09-04T12:01:00Z';
				return Response.json({ ...destination, secret: 'destination-update-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				allDestinations = allDestinations.filter((candidate) => candidate.uuid !== uuid);
				return Response.json({ message: 'Destination deleted.' });
			}
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1')
			return Response.json(server);
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/resources')
			return Response.json([
				{
					uuid: 'app-2',
					name: 'Image App',
					type: 'Application',
					status: 'running',
					updated_at: '2026-09-04T12:00:00Z',
					secret: 'server-resource-fixture-secret'
				},
				{ uuid: 'db-1', name: 'Primary DB', type: 'PostgreSQL', status: 'running' }
			]);
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/domains')
			return Response.json([{ ip: '10.0.0.1', domains: ['app.example.com', 'api.example.com'] }]);
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/envs')
			return Response.json(serverSharedVariables);
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/docker-cleanup')
			return Response.json({ ...serverDockerCleanup, secret: 'cleanup-settings-fixture-secret' });
		if (
			request.method === 'GET' &&
			url.pathname === '/api/v1/servers/server-1/docker-cleanup/executions'
		)
			return Response.json(serverDockerCleanupExecutions);
		if (request.method === 'PATCH' && url.pathname === '/api/v1/servers/server-1/docker-cleanup') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = [
				'docker_cleanup_frequency',
				'docker_cleanup_threshold',
				'force_docker_cleanup',
				'delete_unused_volumes',
				'delete_unused_networks',
				'disable_application_image_retention'
			];
			if (Object.keys(body).some((key) => !allowed.includes(key)))
				return Response.json({ message: 'Unexpected cleanup field.' }, { status: 422 });
			serverDockerCleanup = { ...serverDockerCleanup, ...body } as typeof serverDockerCleanup;
			return Response.json({ ...serverDockerCleanup, secret: 'cleanup-response-fixture-secret' });
		}
		if (
			request.method === 'POST' &&
			url.pathname === '/api/v1/servers/server-1/docker-cleanup/run'
		) {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).length !== 2 ||
				typeof body.delete_unused_volumes !== 'boolean' ||
				typeof body.delete_unused_networks !== 'boolean'
			)
				return Response.json({ message: 'Invalid cleanup run.' }, { status: 422 });
			return Response.json({ message: 'cleanup-run-upstream-fixture-secret' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/proxy')
			return Response.json({ ...serverProxy, extra_secret: 'proxy-metadata-fixture-secret' });
		if (request.method === 'PATCH' && url.pathname === '/api/v1/servers/server-1/proxy') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = ['redirect_enabled', 'redirect_url', 'generate_exact_labels', 'proxy_type'];
			if (Object.keys(body).some((key) => !allowed.includes(key)))
				return Response.json({ message: 'Unexpected proxy field.' }, { status: 422 });
			serverProxy = { ...serverProxy, ...body } as typeof serverProxy;
			return Response.json({ ...serverProxy, extra_secret: 'proxy-response-fixture-secret' });
		}
		if (
			request.method === 'PUT' &&
			url.pathname === '/api/v1/servers/server-1/proxy/configuration'
		) {
			const body = (await request.json()) as { configuration?: unknown };
			if (typeof body.configuration !== 'string' || Object.keys(body).length !== 1)
				return Response.json({ message: 'Invalid proxy configuration.' }, { status: 422 });
			serverProxy.configuration = Buffer.from(body.configuration, 'base64').toString('utf8');
			return Response.json({ ...serverProxy, extra_secret: 'proxy-save-fixture-secret' });
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/servers/server-1/proxy/restart')
			return Response.json({ message: 'proxy-restart-fixture-secret' });
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/cloudflare-tunnel')
			return Response.json({ ...serverTunnel, token: 'tunnel-metadata-fixture-secret' });
		if (
			request.method === 'POST' &&
			url.pathname === '/api/v1/servers/server-1/cloudflare-tunnel/enable'
		) {
			serverTunnel = { ...serverTunnel, is_cloudflare_tunnel: true };
			return Response.json({ ...serverTunnel, message: 'tunnel-enable-fixture-secret' });
		}
		if (
			request.method === 'POST' &&
			url.pathname === '/api/v1/servers/server-1/cloudflare-tunnel/disable'
		) {
			serverTunnel = { ...serverTunnel, is_cloudflare_tunnel: false };
			return Response.json({ ...serverTunnel, message: 'tunnel-disable-fixture-secret' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/sentinel')
			return Response.json({ ...serverSentinel, extra_secret: 'sentinel-extra-fixture-secret' });
		if (request.method === 'PATCH' && url.pathname === '/api/v1/servers/server-1/sentinel') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = [
				'is_sentinel_enabled',
				'is_metrics_enabled',
				'is_sentinel_debug_enabled',
				'sentinel_token',
				'sentinel_metrics_refresh_rate_seconds',
				'sentinel_metrics_history_days',
				'sentinel_push_interval_seconds',
				'sentinel_custom_url'
			];
			if (Object.keys(body).some((key) => !allowed.includes(key)))
				return Response.json({ message: 'Unexpected Sentinel field.' }, { status: 422 });
			serverSentinel = { ...serverSentinel, ...body };
			return Response.json({ ...serverSentinel, extra_secret: 'sentinel-response-fixture-secret' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/servers/server-1/log-drains')
			return Response.json({ ...serverLogDrains, extra_secret: 'drains-extra-fixture-secret' });
		if (request.method === 'PATCH' && url.pathname === '/api/v1/servers/server-1/log-drains') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = [
				'is_logdrain_newrelic_enabled',
				'logdrain_newrelic_license_key',
				'logdrain_newrelic_base_uri',
				'is_logdrain_axiom_enabled',
				'logdrain_axiom_dataset_name',
				'logdrain_axiom_api_key',
				'is_logdrain_custom_enabled',
				'logdrain_custom_config',
				'logdrain_custom_config_parser'
			];
			if (Object.keys(body).some((key) => !allowed.includes(key)))
				return Response.json({ message: 'Unexpected log drain field.' }, { status: 422 });
			serverLogDrains = { ...serverLogDrains, ...body };
			return Response.json({ ...serverLogDrains, extra_secret: 'drains-response-fixture-secret' });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/servers/server-1') {
			const body = (await request.json()) as Record<string, unknown>;
			const general = ['name', 'description', 'ip', 'port', 'user'];
			const advanced = [
				'concurrent_builds',
				'dynamic_timeout',
				'deployment_queue_limit',
				'server_disk_usage_notification_threshold',
				'server_disk_usage_check_frequency',
				'connection_timeout',
				'is_build_server',
				'is_terminal_enabled'
			];
			const allowed = [...general, ...advanced];
			if (Object.keys(body).some((key) => !allowed.includes(key)))
				return Response.json({ message: 'Unexpected field.' }, { status: 422 });
			for (const [key, value] of Object.entries(body)) {
				if (general.includes(key)) Object.assign(server, { [key]: value });
				else Object.assign(server.settings, { [key]: value });
			}
			return Response.json({ uuid: 'server-1', secret: 'server-response-fixture-secret' });
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/servers/server-1/validate') {
			const body = (await request.json()) as Record<string, unknown>;
			if (typeof body.install !== 'boolean' || Object.keys(body).length !== 1)
				return Response.json({ message: 'Invalid validation body.' }, { status: 422 });
			return Response.json(
				{ message: 'upstream-server-validation-fixture-secret' },
				{ status: 201 }
			);
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/github-apps')
			return Response.json(githubApps);
		if (request.method === 'GET' && url.pathname === '/api/v1/gitlab-apps')
			return Response.json(gitlabApps);
		if (request.method === 'GET' && url.pathname === '/api/v1/s3-storages')
			return Response.json(s3Storages);
		if (request.method === 'GET' && url.pathname === '/api/v1/cloud-tokens')
			return Response.json(cloudTokens);
		if (request.method === 'POST' && url.pathname === '/api/v1/cloud-tokens') {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).some((key) => !['name', 'provider', 'token'].includes(key)) ||
				typeof body.name !== 'string' ||
				!['hetzner', 'digitalocean', 'vultr'].includes(String(body.provider)) ||
				typeof body.token !== 'string' ||
				!body.token
			)
				return Response.json({ message: 'Invalid cloud token body.' }, { status: 422 });
			const token = {
				...body,
				uuid: `cloud-token-created-${cloudTokenSequence++}`,
				team_id: 1,
				servers_count: 0,
				created_at: '2026-09-04T12:00:00Z',
				updated_at: '2026-09-04T12:00:00Z'
			};
			cloudTokens.push(token);
			return Response.json(
				{ uuid: token.uuid, token: 'cloud-token-create-response-fixture-secret' },
				{ status: 201 }
			);
		}
		const cloudTokenMatch = url.pathname.match(/^\/api\/v1\/cloud-tokens\/([^/]+)$/);
		if (cloudTokenMatch) {
			const uuid = decodeURIComponent(cloudTokenMatch[1]);
			const token = cloudTokens.find((candidate) => candidate.uuid === uuid);
			if (!token) return Response.json({ message: 'Cloud token not found.' }, { status: 404 });
			if (request.method === 'GET')
				return Response.json({ ...token, token: 'cloud-token-detail-fixture-secret' });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (Object.keys(body).length !== 1 || typeof body.name !== 'string')
					return Response.json({ message: 'Invalid cloud token update.' }, { status: 422 });
				Object.assign(token, body, { updated_at: '2026-09-04T12:01:00Z' });
				return Response.json({ uuid, token: 'cloud-token-update-response-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				if (Number(token.servers_count) > 0)
					return Response.json({ message: 'Token is used by servers.' }, { status: 400 });
				cloudTokens.splice(cloudTokens.indexOf(token), 1);
				return Response.json({ message: 'Cloud token deleted.' });
			}
		}
		const cloudTokenValidateMatch = url.pathname.match(
			/^\/api\/v1\/cloud-tokens\/([^/]+)\/validate$/
		);
		if (request.method === 'POST' && cloudTokenValidateMatch) {
			const uuid = decodeURIComponent(cloudTokenValidateMatch[1]);
			if (!cloudTokens.some((candidate) => candidate.uuid === uuid))
				return Response.json({ message: 'Cloud token not found.' }, { status: 404 });
			return Response.json({ valid: true, message: 'cloud-token-validation-fixture-secret' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/cloud-init-scripts')
			return Response.json(cloudInitScripts);
		const providerLookup: Record<string, unknown> = {
			'/api/v1/digitalocean/regions': [{ slug: 'nyc3', name: 'New York 3', available: true }],
			'/api/v1/digitalocean/sizes': [
				{
					slug: 's-1vcpu-1gb',
					description: 'Basic',
					vcpus: 1,
					memory: 1024,
					disk: 25,
					price_monthly: 6
				}
			],
			'/api/v1/digitalocean/images': [
				{ id: 101, slug: 'ubuntu-24-04-x64', name: 'Ubuntu 24.04', public: true }
			],
			'/api/v1/digitalocean/ssh-keys': [
				{ id: 100, name: 'Existing DO key', public_key: 'provider-public-key-fixture-secret' }
			],
			'/api/v1/hetzner/locations': [{ id: 1, name: 'nbg1', city: 'Nuremberg', country: 'DE' }],
			'/api/v1/hetzner/server-types': [{ id: 2, name: 'cx22', cores: 2, memory: 4, disk: 40 }],
			'/api/v1/hetzner/images': [{ id: 201, name: 'ubuntu-24.04', description: 'Ubuntu 24.04' }],
			'/api/v1/hetzner/ssh-keys': [
				{ id: 200, name: 'Existing Hetzner key', public_key: 'provider-public-key-fixture-secret' }
			],
			'/api/v1/hetzner/firewalls': [{ id: 300, name: 'Web firewall' }],
			'/api/v1/hetzner/networks': [{ id: 400, name: 'Private network', ip_range: '10.0.0.0/16' }],
			'/api/v1/vultr/regions': [{ id: 'ewr', city: 'New Jersey', country: 'US' }],
			'/api/v1/vultr/plans': [
				{ id: 'vc2-1c-1gb', vcpu_count: 1, ram: 1024, disk: 25, monthly_cost: 6 }
			],
			'/api/v1/vultr/os': [{ id: 301, name: 'Ubuntu 24.04', family: 'ubuntu' }],
			'/api/v1/vultr/ssh-keys': [
				{
					id: 'vultr-key',
					name: 'Existing Vultr key',
					ssh_key: 'provider-public-key-fixture-secret'
				}
			]
		};
		if (request.method === 'GET' && url.pathname in providerLookup) {
			const provider = url.pathname.split('/')[3];
			const tokenUuid = url.searchParams.get('cloud_provider_token_uuid');
			if (!cloudTokens.some((token) => token.provider === provider && token.uuid === tokenUuid))
				return Response.json({ message: 'Provider token not found.' }, { status: 404 });
			return Response.json(providerLookup[url.pathname]);
		}
		const provisionMatch = url.pathname.match(/^\/api\/v1\/servers\/(digitalocean|hetzner|vultr)$/);
		if (request.method === 'POST' && provisionMatch) {
			const provider = provisionMatch[1];
			const body = (await request.json()) as Record<string, unknown>;
			const allowed: Record<string, string[]> = {
				digitalocean: [
					'cloud_provider_token_uuid',
					'region',
					'size',
					'image',
					'name',
					'private_key_uuid',
					'enable_ipv6',
					'monitoring',
					'digitalocean_ssh_key_ids',
					'cloud_init_script',
					'instant_validate'
				],
				hetzner: [
					'cloud_provider_token_uuid',
					'location',
					'server_type',
					'image',
					'name',
					'private_key_uuid',
					'enable_ipv4',
					'enable_ipv6',
					'enable_backups',
					'hetzner_ssh_key_ids',
					'hetzner_firewall_ids',
					'hetzner_network_ids',
					'cloud_init_script',
					'instant_validate'
				],
				vultr: [
					'cloud_provider_token_uuid',
					'region',
					'plan',
					'os_id',
					'name',
					'private_key_uuid',
					'enable_ipv6',
					'disable_public_ipv4',
					'vultr_ssh_key_ids',
					'cloud_init_script',
					'instant_validate'
				]
			};
			if (
				Object.keys(body).some((key) => !allowed[provider].includes(key)) ||
				body.private_key_uuid !== 'key-1' ||
				!cloudTokens.some(
					(token) => token.provider === provider && token.uuid === body.cloud_provider_token_uuid
				)
			)
				return Response.json({ message: 'Invalid provider server body.' }, { status: 422 });
			createdServer = {
				uuid: 'server-created',
				name: body.name,
				description: `${provider} provisioned server`,
				ip: '203.0.113.25',
				port: 22,
				user: 'root',
				status: 'running',
				settings: { is_reachable: true, is_usable: false, is_build_server: false }
			};
			const existing = servers.findIndex((candidate) => candidate.uuid === 'server-created');
			if (existing >= 0) servers.splice(existing, 1, createdServer);
			else servers.push(createdServer);
			return Response.json(
				{ uuid: 'server-created', provider_response_secret: 'provider-create-fixture-secret' },
				{ status: 201 }
			);
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/cloud-init-scripts') {
			const body = (await request.json()) as Record<string, unknown>;
			if (
				Object.keys(body).some((key) => !['name', 'script'].includes(key)) ||
				typeof body.name !== 'string' ||
				typeof body.script !== 'string' ||
				!body.script
			)
				return Response.json({ message: 'Invalid cloud-init body.' }, { status: 422 });
			const script = {
				...body,
				uuid: `cloud-init-created-${cloudInitSequence++}`,
				team_id: 1,
				created_at: '2026-09-04T12:00:00Z',
				updated_at: '2026-09-04T12:00:00Z'
			};
			cloudInitScripts.push(script);
			return Response.json(
				{ uuid: script.uuid, script: 'cloud-init-create-response-fixture-secret' },
				{ status: 201 }
			);
		}
		const cloudInitMatch = url.pathname.match(/^\/api\/v1\/cloud-init-scripts\/([^/]+)$/);
		if (cloudInitMatch) {
			const uuid = decodeURIComponent(cloudInitMatch[1]);
			const script = cloudInitScripts.find((candidate) => candidate.uuid === uuid);
			if (!script)
				return Response.json({ message: 'Cloud-init script not found.' }, { status: 404 });
			if (request.method === 'GET')
				return Response.json({ ...script, script: 'cloud-init-detail-fixture-secret' });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				if (
					Object.keys(body).some((key) => !['name', 'script'].includes(key)) ||
					!Object.keys(body).length
				)
					return Response.json({ message: 'Invalid cloud-init update.' }, { status: 422 });
				Object.assign(script, body, { updated_at: '2026-09-04T12:01:00Z' });
				return Response.json({ uuid, script: 'cloud-init-update-response-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				cloudInitScripts.splice(cloudInitScripts.indexOf(script), 1);
				return Response.json({ message: 'Cloud-init script deleted.' });
			}
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/s3-storages') {
			const body = (await request.json()) as Record<string, unknown>;
			const allowed = [
				'name',
				'description',
				'endpoint',
				'bucket',
				'region',
				'key',
				'secret',
				'is_usable'
			];
			if (
				Object.keys(body).some((key) => !allowed.includes(key)) ||
				!['name', 'endpoint', 'bucket', 'region', 'key', 'secret'].every(
					(key) => typeof body[key] === 'string' && body[key] !== ''
				)
			)
				return Response.json({ message: 'Invalid S3 body.' }, { status: 422 });
			const storage = {
				...body,
				uuid: `s3-created-${s3Sequence++}`,
				team_id: 1,
				created_at: '2026-09-04T12:00:00Z',
				updated_at: '2026-09-04T12:00:00Z'
			};
			s3Storages.push(storage);
			return Response.json(
				{ uuid: storage.uuid, secret: 's3-create-response-fixture-secret' },
				{ status: 201 }
			);
		}
		const s3Match = url.pathname.match(/^\/api\/v1\/s3-storages\/([^/]+)$/);
		if (s3Match) {
			const uuid = decodeURIComponent(s3Match[1]);
			const storage = s3Storages.find((candidate) => candidate.uuid === uuid);
			if (!storage) return Response.json({ message: 'S3 storage not found.' }, { status: 404 });
			if (request.method === 'GET')
				return Response.json({ ...storage, reveal: 's3-detail-fixture-secret' });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				const allowed = [
					'name',
					'description',
					'endpoint',
					'bucket',
					'region',
					'key',
					'secret',
					'is_usable'
				];
				if (Object.keys(body).some((key) => !allowed.includes(key)))
					return Response.json({ message: 'Invalid S3 update.' }, { status: 422 });
				Object.assign(storage, body, { updated_at: '2026-09-04T12:01:00Z' });
				return Response.json({ uuid, secret: 's3-update-response-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				s3Storages.splice(s3Storages.indexOf(storage), 1);
				return Response.json({ message: 'S3 storage deleted.' });
			}
		}
		const s3ValidateMatch = url.pathname.match(/^\/api\/v1\/s3-storages\/([^/]+)\/validate$/);
		if (request.method === 'POST' && s3ValidateMatch) {
			const uuid = decodeURIComponent(s3ValidateMatch[1]);
			const storage = s3Storages.find((candidate) => candidate.uuid === uuid);
			if (!storage) return Response.json({ message: 'S3 storage not found.' }, { status: 404 });
			storage.is_usable = true;
			return Response.json({
				valid: true,
				message: 's3-validation-response-fixture-secret'
			});
		}
		if (
			request.method === 'POST' &&
			['/api/v1/github-apps', '/api/v1/gitlab-apps'].includes(url.pathname)
		) {
			const body = (await request.json()) as Record<string, unknown>;
			const github = url.pathname.endsWith('/github-apps');
			const allowed = github
				? [
						'name',
						'organization',
						'api_url',
						'html_url',
						'custom_user',
						'custom_port',
						'app_id',
						'installation_id',
						'client_id',
						'client_secret',
						'webhook_secret',
						'private_key_uuid',
						'is_system_wide'
					]
				: [
						'name',
						'html_url',
						'api_url',
						'custom_user',
						'custom_port',
						'group_name',
						'client_id',
						'client_secret',
						'webhook_token',
						'redirect_uri',
						'is_system_wide'
					];
			if (
				Object.keys(body).some((key) => !allowed.includes(key)) ||
				typeof body.name !== 'string' ||
				typeof body.html_url !== 'string' ||
				(github && body.private_key_uuid !== 'key-1')
			)
				return Response.json({ message: 'Invalid source body.' }, { status: 422 });
			const id = sourceSequence++;
			const source: Record<string, unknown> = {
				...body,
				id,
				uuid: `${github ? 'github' : 'gitlab'}-app-created-${id}`,
				team_id: 1,
				is_public: false,
				...(github ? { private_key_id: 3 } : {})
			};
			delete source.private_key_uuid;
			(github ? githubApps : gitlabApps).push(source);
			return Response.json(
				{ ...source, access_token: 'source-create-response-fixture-secret' },
				{ status: 201 }
			);
		}
		const sourceMatch = url.pathname.match(/^\/api\/v1\/(github|gitlab)-apps\/(\d+)$/);
		if (sourceMatch) {
			const provider = sourceMatch[1];
			const id = Number(sourceMatch[2]);
			const collection = provider === 'github' ? githubApps : gitlabApps;
			const source = collection.find((candidate) => candidate.id === id);
			if (!source) return Response.json({ message: 'Source not found.' }, { status: 404 });
			if (request.method === 'PATCH') {
				const body = (await request.json()) as Record<string, unknown>;
				Object.assign(source, body);
				if (body.private_key_uuid === 'key-1') source.private_key_id = 3;
				delete source.private_key_uuid;
				return Response.json({ ...source, access_token: 'source-update-response-fixture-secret' });
			}
			if (request.method === 'DELETE') {
				collection.splice(collection.indexOf(source), 1);
				return Response.json({ message: 'Source deleted.' });
			}
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/github-apps/7/repositories') {
			return Response.json({
				repositories: [
					{ name: 'website', full_name: 'widube/website', private: true },
					{ name: 'api', full_name: 'widube/api', private: true }
				]
			});
		}
		if (
			request.method === 'GET' &&
			url.pathname === '/api/v1/github-apps/7/repositories/widube/api/branches'
		) {
			return Response.json({ branches: [{ name: 'main' }, { name: 'develop' }] });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-cloned') {
			return clonedApplication
				? Response.json(clonedApplication)
				: Response.json({ message: 'Application not found.' }, { status: 404 });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-delete') {
			return deletableApplicationExists
				? Response.json({
						uuid: 'app-delete',
						environment_id: 1,
						name: 'Disposable App',
						status: 'stopped',
						build_pack: 'dockerimage'
					})
				: Response.json({ message: 'Application not found.' }, { status: 404 });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/applications/app-1') {
			const body = (await request.json()) as Record<string, unknown>;
			gitApplication = { ...gitApplication, ...body };
			return Response.json({ uuid: 'app-1' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-2/destinations') {
			return Response.json(applicationDestinations);
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/destinations') {
			const body = (await request.json()) as { destination_uuid?: string };
			const destination = allDestinations.find(
				(candidate) => candidate.uuid === body.destination_uuid
			);
			if (!destination)
				return Response.json({ message: 'Destination not found.' }, { status: 404 });
			if (applicationDestinations.some((candidate) => candidate.uuid === destination.uuid))
				return Response.json({ message: 'Destination is already attached.' }, { status: 422 });
			applicationDestinations.push({
				uuid: destination.uuid,
				name: destination.name,
				network: destination.network,
				server_uuid: destination.server_uuid,
				is_primary: false
			});
			return Response.json(
				{ message: 'Destination attached.', uuid: destination.uuid },
				{ status: 201 }
			);
		}
		const destinationDeleteMatch = url.pathname.match(
			/^\/api\/v1\/applications\/app-2\/destinations\/([^/]+)$/
		);
		if (request.method === 'DELETE' && destinationDeleteMatch) {
			const destinationUuid = decodeURIComponent(destinationDeleteMatch[1]);
			const destination = applicationDestinations.find(
				(candidate) => candidate.uuid === destinationUuid
			);
			if (!destination)
				return Response.json({ message: 'Destination not found.' }, { status: 404 });
			if (destination.is_primary)
				return Response.json(
					{ message: 'Cannot remove the primary destination.' },
					{ status: 422 }
				);
			applicationDestinations = applicationDestinations.filter(
				(candidate) => candidate.uuid !== destinationUuid
			);
			return Response.json({ message: 'Destination detached.' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-2/rollback-images') {
			return Response.json(rollbackImages);
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/rollback') {
			const body = (await request.json()) as { commit?: string };
			if (body.commit !== 'previous-sha')
				return Response.json({ message: 'Invalid rollback image.' }, { status: 422 });
			return Response.json({
				message: 'Rollback deployment queued.',
				deployment_uuid: 'rollback-deploy-1'
			});
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-2/tags') {
			return Response.json(applicationTags);
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/tags') {
			const body = (await request.json()) as { tag_names?: string[] };
			for (const name of body.tag_names ?? []) {
				if (!applicationTags.some((tag) => tag.name === name))
					applicationTags.push({ uuid: `tag-${tagSequence++}`, name });
			}
			return Response.json(applicationTags, { status: 201 });
		}
		const tagDeleteMatch = url.pathname.match(/^\/api\/v1\/applications\/app-2\/tags\/([^/]+)$/);
		if (request.method === 'DELETE' && tagDeleteMatch) {
			const tagUuid = decodeURIComponent(tagDeleteMatch[1]);
			const before = applicationTags.length;
			applicationTags = applicationTags.filter((tag) => tag.uuid !== tagUuid);
			return before === applicationTags.length
				? Response.json({ message: 'Tag not found.' }, { status: 404 })
				: Response.json({ message: 'Tag removed.' });
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/clone') {
			const body = (await request.json()) as Record<string, unknown>;
			if (body.destination_uuid !== 'destination-2')
				return Response.json({ message: 'Destination not found.' }, { status: 404 });
			clonedApplication = {
				...application,
				uuid: 'app-cloned',
				name: typeof body.name === 'string' && body.name ? body.name : 'Image App clone'
			};
			return Response.json({ uuid: 'app-cloned', message: 'Application cloned.' }, { status: 201 });
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/move') {
			const body = (await request.json()) as Record<string, unknown>;
			if (body.environment_uuid !== 'environment-1')
				return Response.json({ message: 'Target environment not found.' }, { status: 404 });
			return Response.json({
				message: 'Application moved successfully.',
				uuid: 'app-2',
				project_uuid: 'project-1',
				environment_uuid: 'environment-1'
			});
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/migrate') {
			const body = (await request.json()) as Record<string, unknown>;
			if (body.destination_uuid !== 'destination-2' || body.migrate_volumes !== true)
				return Response.json({ message: 'Invalid migration request.' }, { status: 422 });
			return Response.json({ message: 'Application migration started.', uuid: 'app-2' });
		}
		if (request.method === 'DELETE' && url.pathname === '/api/v1/applications/app-delete') {
			const expected = [
				'delete_configurations',
				'delete_volumes',
				'docker_cleanup',
				'delete_connected_networks'
			];
			if (expected.some((key) => url.searchParams.get(key) !== 'true'))
				return Response.json({ message: 'Cleanup options were not forwarded.' }, { status: 422 });
			deletableApplicationExists = false;
			return Response.json({ message: 'Application deletion request queued.' });
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/start')
			return Response.json({ message: 'Start queued.' });
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/envs') {
			const body = (await request.json()) as Record<string, unknown>;
			const existing = applicationVariables.find(
				(variable) =>
					variable.key === body.key && Boolean(variable.is_preview) === Boolean(body.is_preview)
			);
			if (existing) {
				return Response.json(
					{ message: 'Environment variable already exists. Use PATCH request to update it.' },
					{ status: 409 }
				);
			}
			const variable = { uuid: `env-${environmentVariableSequence++}`, ...body };
			applicationVariables = [...applicationVariables, variable];
			return Response.json({ uuid: variable.uuid }, { status: 201 });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/applications/app-2/envs') {
			const body = (await request.json()) as Record<string, unknown>;
			const index = applicationVariables.findIndex(
				(variable) =>
					variable.key === body.key && Boolean(variable.is_preview) === Boolean(body.is_preview)
			);
			if (index < 0)
				return Response.json({ message: 'Environment variable not found.' }, { status: 404 });
			applicationVariables[index] = { ...applicationVariables[index], ...body };
			return Response.json(applicationVariables[index], { status: 201 });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/applications/app-2/envs/bulk') {
			const body = (await request.json()) as { data?: Array<Record<string, unknown>> };
			if (!body.data?.length)
				return Response.json({ message: 'Bulk data is required.' }, { status: 400 });
			for (const input of body.data) {
				const index = applicationVariables.findIndex(
					(variable) =>
						variable.key === input.key && Boolean(variable.is_preview) === Boolean(input.is_preview)
				);
				if (index >= 0) applicationVariables[index] = { ...applicationVariables[index], ...input };
				else {
					applicationVariables.push({ uuid: `env-${environmentVariableSequence++}`, ...input });
				}
			}
			return Response.json(applicationVariables, { status: 201 });
		}
		if (
			request.method === 'DELETE' &&
			url.pathname.startsWith('/api/v1/applications/app-2/envs/')
		) {
			const envUuid = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
			const previousLength = applicationVariables.length;
			applicationVariables = applicationVariables.filter((variable) => variable.uuid !== envUuid);
			if (applicationVariables.length === previousLength)
				return Response.json({ message: 'Environment variable not found.' }, { status: 404 });
			return Response.json({ message: 'Environment variable deleted.' });
		}
		if (request.method === 'GET' && url.pathname === '/api/v1/applications/app-2/scheduled-tasks') {
			return Response.json(scheduledTasks);
		}
		if (
			request.method === 'POST' &&
			url.pathname === '/api/v1/applications/app-2/scheduled-tasks'
		) {
			const body = (await request.json()) as Record<string, unknown>;
			const task = { uuid: `task-${scheduledTaskSequence++}`, ...body };
			scheduledTasks.push(task);
			scheduledTaskExecutions.set(String(task.uuid), []);
			return Response.json(task, { status: 201 });
		}
		const scheduledTaskMatch = url.pathname.match(
			/^\/api\/v1\/applications\/app-2\/scheduled-tasks\/([^/]+)(?:\/(executions|execute))?$/
		);
		if (scheduledTaskMatch) {
			const taskUuid = decodeURIComponent(scheduledTaskMatch[1]);
			const operation = scheduledTaskMatch[2];
			const index = scheduledTasks.findIndex((task) => task.uuid === taskUuid);
			if (index < 0)
				return Response.json({ message: 'Scheduled task not found.' }, { status: 404 });
			if (request.method === 'GET' && operation === 'executions') {
				return Response.json(scheduledTaskExecutions.get(taskUuid) ?? []);
			}
			if (request.method === 'POST' && operation === 'execute') {
				const timestamp = new Date().toISOString();
				const execution = {
					uuid: `task-execution-${scheduledTaskExecutionSequence++}`,
					status: 'success',
					message: 'Task completed',
					retry_count: 0,
					duration: 0.75,
					started_at: timestamp,
					finished_at: timestamp,
					created_at: timestamp
				};
				scheduledTaskExecutions.set(taskUuid, [
					execution,
					...(scheduledTaskExecutions.get(taskUuid) ?? [])
				]);
				return Response.json({ message: 'Scheduled task execution queued.' });
			}
			if (request.method === 'PATCH' && !operation) {
				const body = (await request.json()) as Record<string, unknown>;
				scheduledTasks[index] = { ...scheduledTasks[index], ...body };
				return Response.json(scheduledTasks[index]);
			}
			if (request.method === 'DELETE' && !operation) {
				scheduledTasks = scheduledTasks.filter((task) => task.uuid !== taskUuid);
				scheduledTaskExecutions.delete(taskUuid);
				return Response.json({ message: 'Scheduled task deleted.' });
			}
		}
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/storages') {
			const body = (await request.json()) as Record<string, unknown>;
			const storage: Record<string, unknown> = {
				uuid: `storage-${storageSequence++}`,
				...body,
				is_preview_suffix_enabled: true,
				...(body.type === 'file' && body.is_directory !== true && body.is_host_file !== true
					? {
							fs_path: `/data/coolify/applications/app-2/${String(body.mount_path).split('/').at(-1)}`
						}
					: {})
			};
			if (body.type === 'persistent') {
				storage.name = `app-2-${String(body.name)}`;
				applicationStorages.persistent_storages.push(storage);
			} else applicationStorages.file_storages.push(storage);
			return Response.json(storage, { status: 201 });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/applications/app-2/storages') {
			const body = (await request.json()) as Record<string, unknown>;
			const collection =
				body.type === 'persistent'
					? applicationStorages.persistent_storages
					: applicationStorages.file_storages;
			const index = collection.findIndex((storage) => storage.uuid === body.uuid);
			if (index < 0) return Response.json({ message: 'Storage not found.' }, { status: 404 });
			collection[index] = { ...collection[index], ...body };
			return Response.json(collection[index]);
		}
		const backupMatch = url.pathname.match(
			/^\/api\/v1\/applications\/app-2\/storages\/([^/]+)\/backups(?:\/(run))?$/
		);
		if (backupMatch) {
			const storageUuid = decodeURIComponent(backupMatch[1]);
			const storage = [
				...applicationStorages.persistent_storages,
				...applicationStorages.file_storages
			].find((candidate) => candidate.uuid === storageUuid);
			if (!storage) return Response.json({ message: 'Storage not found.' }, { status: 404 });
			if (request.method === 'PUT' && !backupMatch[2]) {
				const body = (await request.json()) as Record<string, unknown>;
				const fileIsEligible = storage.type !== 'file' || storage.is_directory === true;
				if (!fileIsEligible || storage.is_host_file === true) {
					return Response.json(
						{ message: 'Only directory file storages can be backed up.' },
						{ status: 422 }
					);
				}
				const schedule = {
					uuid: `backup-${storageUuid}`,
					storage_uuid: storageUuid,
					storage_type: storage.type === 'persistent' ? 'persistent' : 'directory',
					...body
				};
				storageBackupSchedules.set(storageUuid, schedule);
				return Response.json(
					{ message: 'Storage backup schedule created.', ...schedule },
					{ status: 201 }
				);
			}
			if (request.method === 'POST' && backupMatch[2] === 'run') {
				const schedule = storageBackupSchedules.get(storageUuid);
				if (!schedule)
					return Response.json({ message: 'Storage backup schedule not found.' }, { status: 404 });
				return Response.json({ message: 'Storage backup queued.', uuid: schedule.uuid });
			}
			if (request.method === 'DELETE' && !backupMatch[2]) {
				if (!storageBackupSchedules.delete(storageUuid)) {
					return Response.json({ message: 'Storage backup schedule not found.' }, { status: 404 });
				}
				return Response.json({ message: 'Storage backup schedule and archives deleted.' });
			}
		}
		const storageDeleteMatch = url.pathname.match(
			/^\/api\/v1\/applications\/app-2\/storages\/([^/]+)$/
		);
		if (request.method === 'DELETE' && storageDeleteMatch) {
			const storageUuid = decodeURIComponent(storageDeleteMatch[1]);
			if (storageBackupSchedules.has(storageUuid)) {
				return Response.json(
					{ message: 'Delete this volume backup schedule before deleting the volume.' },
					{ status: 422 }
				);
			}
			const before =
				applicationStorages.persistent_storages.length + applicationStorages.file_storages.length;
			applicationStorages = {
				persistent_storages: applicationStorages.persistent_storages.filter(
					(storage) => storage.uuid !== storageUuid
				),
				file_storages: applicationStorages.file_storages.filter(
					(storage) => storage.uuid !== storageUuid
				)
			};
			const after =
				applicationStorages.persistent_storages.length + applicationStorages.file_storages.length;
			if (before === after)
				return Response.json({ message: 'Storage not found.' }, { status: 404 });
			return Response.json({ message: 'Storage deleted.' });
		}
		if (request.method === 'PATCH' && url.pathname === '/api/v1/applications/app-2') {
			const body = (await request.json()) as Record<string, unknown>;
			if (body.max_restart_count === 13) {
				return Response.json(
					{
						message: 'The submitted application configuration is invalid.',
						errors: { max_restart_count: ['Unlucky restart count.'] }
					},
					{ status: 422 }
				);
			}
			if (
				typeof body.domains === 'string' &&
				body.domains.includes('https://conflict.example.com') &&
				body.force_domain_override !== true
			) {
				return Response.json(
					{
						message: 'Domain conflicts detected. Use force_domain_override=true to proceed.',
						warning: 'The same domain is already in use.',
						conflicts: [
							{
								domain: 'https://conflict.example.com',
								resource_name: 'Existing site',
								resource_uuid: 'other-app',
								resource_type: 'application',
								message: 'Domain already used'
							}
						]
					},
					{ status: 409 }
				);
			}
			const domains = body.domains;
			const isForceHttpsEnabled = body.is_force_https_enabled;
			const updates = { ...body };
			delete updates.domains;
			delete updates.is_force_https_enabled;
			delete updates.force_domain_override;
			application = {
				...application,
				...updates,
				...(typeof domains === 'string' ? { fqdn: domains } : {}),
				settings: {
					...((application.settings as Record<string, unknown> | undefined) ?? {}),
					...(typeof isForceHttpsEnabled === 'boolean'
						? { is_force_https_enabled: isForceHttpsEnabled }
						: {})
				}
			};
			return Response.json({ uuid: 'app-2' });
		}
		if (url.pathname in responses) return Response.json(responses[url.pathname]);
		return Response.json({ message: 'Resource not found.' }, { status: 404 });
	}
});
