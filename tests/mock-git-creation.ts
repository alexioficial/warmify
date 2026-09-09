export async function mockGitCreation(request: Request): Promise<Response | undefined> {
	const path = new URL(request.url).pathname;
	if (request.method === 'GET' && path === '/api/v1/security/keys')
		return Response.json([{ uuid: 'key-1', name: 'Deploy key', private_key: 'git-key-secret' }]);
	if (
		request.method !== 'POST' ||
		![
			'/api/v1/applications/public',
			'/api/v1/applications/private-deploy-key',
			'/api/v1/applications/private-github-app'
		].includes(path)
	)
		return undefined;
	const body = (await request.json()) as Record<string, unknown>;
	const allowed = [
		'project_uuid',
		'environment_uuid',
		'server_uuid',
		'destination_uuid',
		'name',
		'description',
		'git_repository',
		'git_branch',
		'build_pack',
		'base_directory',
		'publish_directory',
		'install_command',
		'build_command',
		'start_command',
		'is_static',
		'dockerfile_location',
		'docker_compose_location',
		'docker_compose_custom_build_command',
		'docker_compose_custom_start_command',
		'domains',
		'ports_exposes',
		'instant_deploy',
		'autogenerate_domain',
		'private_key_uuid',
		'github_app_uuid'
	];
	const invalid = () =>
		Response.json({ message: 'Invalid Git creation payload.' }, { status: 422 });
	if (
		Object.keys(body).some((key) => !allowed.includes(key)) ||
		body.project_uuid !== 'project-1' ||
		body.environment_uuid !== 'environment-1' ||
		body.server_uuid !== 'server-1' ||
		!body.git_repository ||
		!body.git_branch
	)
		return invalid();
	if (
		path.endsWith('private-github-app') &&
		(body.github_app_uuid !== 'github-app-1' ||
			body.git_repository !== 'widube/api' ||
			body.git_branch !== 'develop')
	)
		return invalid();
	if (path.endsWith('private-deploy-key') && body.private_key_uuid !== 'key-1') return invalid();
	if (
		body.build_pack === 'dockercompose' &&
		('domains' in body || 'ports_exposes' in body || !body.docker_compose_location)
	)
		return invalid();
	if (body.name === 'Reject Git')
		return Response.json(
			{
				message: 'git-command-secret fragment',
				errors: { build_command: ['git-command-secret'], name: ['git-response-secret'] }
			},
			{ status: 422 }
		);
	return Response.json({ uuid: 'app-1', token: 'git-response-secret' }, { status: 201 });
}
