const projects = [
	{
		id: 1,
		uuid: 'project-1',
		name: 'Documentation',
		description: 'Main project',
		environments_count: 1,
		resources_count: 1
	}
];
const servers = [
	{ id: 1, uuid: 'server-1', name: 'Primary server', ip: '10.0.0.1', status: 'running' }
];
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
const sources = [
	{
		uuid: 'source-1',
		name: 'widube',
		provider: 'GitHub',
		status: 'connected'
	}
];
const environments = [
	{
		id: 1,
		uuid: 'environment-1',
		name: 'production',
		description: 'Production resources',
		applications: [
			{
				uuid: 'app-1',
				name: 'Website',
				status: 'running:healthy',
				fqdn: 'https://example.com'
			}
		],
		services: [],
		databases: []
	}
];
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

Bun.serve({
	port: 4010,
	async fetch(request: Request) {
		if (request.headers.get('Authorization') !== 'Bearer 1|e2e-secret')
			return Response.json({ message: 'Unauthenticated.' }, { status: 401 });
		const url = new URL(request.url);
		const responses: Record<string, unknown> = {
			'/api/v1/projects': projects,
			'/api/v1/projects/project-1': { ...projects[0], environments },
			'/api/v1/projects/project-1/environment-1': environments[0],
			'/api/v1/projects/project-1/environments': environments,
			'/api/v1/projects/project-1/envs': [],
			'/api/v1/servers': servers,
			'/api/v1/github-apps': sources,
			'/api/v1/destinations': [
				{ uuid: 'destination-1', name: 'Primary destination', server: { name: 'Primary server' } }
			],
			'/api/v1/deployments': deployments,
			'/api/v1/deployments/applications/app-2': [],
			'/api/v1/version': { version: '4.2.0' },
			'/api/v1/resources': [{ uuid: 'app-1', environment_id: 1, type: 'application' }],
			'/api/v1/applications': [],
			'/api/v1/applications/app-2': application,
			'/api/v1/applications/app-1': {
				uuid: 'app-1',
				environment_id: 1,
				name: 'Website',
				status: 'running:healthy',
				fqdn: 'https://example.com',
				git_repository: 'widube/website',
				build_pack: 'railpack'
			},
			'/api/v1/applications/app-2/envs': [],
			'/api/v1/applications/app-2/storages': [],
			'/api/v1/applications/app-2/scheduled-tasks': [],
			'/api/v1/applications/app-2/logs': { logs: 'Container started\nListening on port 80' },
			'/api/v1/services': [],
			'/api/v1/databases': []
		};
		if (url.pathname === '/api/v1/health') return new Response('OK');
		if (request.method === 'POST' && url.pathname === '/api/v1/projects')
			return Response.json({ uuid: 'project-2' }, { status: 201 });
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/dockerimage')
			return Response.json({ uuid: 'app-2' }, { status: 201 });
		if (request.method === 'POST' && url.pathname === '/api/v1/applications/app-2/start')
			return Response.json({ message: 'Start queued.' });
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
