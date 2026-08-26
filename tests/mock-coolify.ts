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
const application = {
	uuid: 'app-2',
	name: 'Image App',
	description: 'Created from Docker image',
	status: 'running:healthy',
	fqdn: 'https://image.example.com',
	docker_registry_image_name: 'nginx',
	docker_registry_image_tag: 'latest',
	environment: { name: 'production' },
	server: { name: 'Primary server' }
};

Bun.serve({
	port: 4010,
	fetch(request: Request) {
		if (request.headers.get('Authorization') !== 'Bearer 1|e2e-secret')
			return Response.json({ message: 'Unauthenticated.' }, { status: 401 });
		const url = new URL(request.url);
		const responses: Record<string, unknown> = {
			'/api/v1/projects': projects,
			'/api/v1/projects/project-1': { ...projects[0], environments },
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
			'/api/v1/resources': [],
			'/api/v1/applications': [],
			'/api/v1/applications/app-2': application,
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
		if (url.pathname in responses) return Response.json(responses[url.pathname]);
		return Response.json({ message: 'Resource not found.' }, { status: 404 });
	}
});
