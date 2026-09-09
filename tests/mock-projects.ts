import { mockSharedVariables } from './mock-shared-variables';

interface Environment {
	id: number;
	uuid: string;
	name: string;
	description: string;
	applications: Array<Record<string, unknown>>;
	services: Array<Record<string, unknown>>;
	databases: Array<Record<string, unknown>>;
}
interface Project {
	id: number;
	uuid: string;
	name: string;
	description: string;
	environments: Environment[];
}
const projects: Project[] = [
	{
		id: 1,
		uuid: 'project-1',
		name: 'Documentation',
		description: 'Main project',
		environments: [
			{
				id: 1,
				uuid: 'environment-1',
				name: 'production',
				description: 'Production resources',
				applications: [
					{ uuid: 'app-1', name: 'Website', status: 'running:healthy', fqdn: 'https://example.com' }
				],
				services: [],
				databases: []
			}
		]
	}
];
let sequence = 2;
function newEnvironment(name: string): Environment {
	const id = sequence++;
	return {
		id,
		uuid: `environment-${id}`,
		name,
		description: '',
		applications: [],
		services: [],
		databases: []
	};
}
const count = (environment: Environment) =>
	environment.applications.length + environment.services.length + environment.databases.length;
const response = (message: string, status: number) => Response.json({ message }, { status });
export async function mockProjects(request: Request) {
	const parts = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
	if (parts[0] !== 'api' || parts[1] !== 'v1' || parts[2] !== 'projects') return;
	const method = request.method;
	const [, , , uuid, resource, environmentId] = parts;
	if (!uuid && method === 'GET')
		return Response.json(
			projects.map((project) => ({
				...project,
				environments_count: project.environments.length,
				resources_count: project.environments.reduce((total, env) => total + count(env), 0)
			}))
		);
	const project = projects.find((entry) => entry.uuid === uuid);
	if (uuid && !project) return response('Project not found.', 404);
	if (project && resource === 'envs')
		return mockSharedVariables(request, `/projects/${uuid}`, environmentId);
	if (project && resource === 'environments' && parts[6] === 'envs') {
		const owner =
			project.environments.find((entry) => entry.name === environmentId) ??
			project.environments.find((entry) => entry.uuid === environmentId);
		if (!owner) return response('Environment not found.', 404);
		return mockSharedVariables(request, `/projects/${uuid}/environments/${owner.uuid}`, parts[7]);
	}
	if (method === 'GET' && project) {
		if (!resource) return Response.json(project);
		if (resource === 'environments') return Response.json(project.environments);
		const environment =
			project.environments.find((entry) => entry.name === resource) ??
			project.environments.find((entry) => entry.uuid === resource);
		return environment ? Response.json(environment) : response('Environment not found.', 404);
	}
	const environment =
		project?.environments.find((entry) => entry.name === environmentId) ??
		project?.environments.find((entry) => entry.uuid === environmentId);
	if (environmentId && !environment) return response('Environment not found.', 404);
	if (method === 'DELETE' && project) {
		if (resource && resource !== 'environments') return response('Not found.', 404);
		if (
			environment ? count(environment) > 0 : project.environments.some((entry) => count(entry) > 0)
		)
			return response(
				`${environment ? 'Environment' : 'Project'} has resources, so it cannot be deleted.`,
				400
			);
		if (environment)
			project.environments = project.environments.filter(
				(entry) => entry.uuid !== environment.uuid
			);
		else projects.splice(projects.indexOf(project), 1);
		return response('Deleted.', 200);
	}
	if (method !== 'POST' && method !== 'PATCH') return response('Not found.', 404);
	const body = (await request.json()) as Record<string, unknown>;
	const creatingEnvironment = method === 'POST' && resource === 'environments';
	const allowed = creatingEnvironment ? ['name'] : ['name', 'description'];
	if (Object.keys(body).some((key) => !allowed.includes(key)))
		return response('This field is not allowed.', 422);
	if (typeof body.name !== 'string' || body.name.length < 3) return response('Invalid name.', 422);
	if (body.name === 'Reserved project')
		return Response.json(
			{ message: 'Validation failed.', errors: { name: ['Choose another project name.'] } },
			{ status: 422 }
		);
	if (!uuid && method === 'POST') {
		const id = sequence++;
		const created = {
			id,
			uuid: `project-${id}`,
			name: body.name,
			description: String(body.description ?? ''),
			environments: [newEnvironment('production')]
		};
		projects.push(created);
		return Response.json({ uuid: created.uuid }, { status: 201 });
	}
	if (creatingEnvironment && project) {
		if (project.environments.some((entry) => entry.name === body.name))
			return response('Environment with this name already exists.', 409);
		const created = newEnvironment(body.name);
		project.environments.push(created);
		return Response.json({ uuid: created.uuid }, { status: 201 });
	}
	if (method === 'PATCH' && project) {
		if (
			environment &&
			project.environments.some(
				(entry) => entry.uuid !== environment.uuid && entry.name === body.name
			)
		)
			return response('Environment with this name already exists.', 409);
		const target = environment ?? project;
		target.name = body.name;
		target.description = String(body.description ?? '');
		return Response.json(
			{ uuid: target.uuid, name: target.name, description: target.description },
			{ status: 201 }
		);
	}
	return response('Not found.', 404);
}
