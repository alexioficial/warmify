export async function mockDockerCreation(request: Request): Promise<Response | undefined> {
	const path = new URL(request.url).pathname;
	if (
		request.method !== 'POST' ||
		![
			'/api/v1/applications/dockerfile',
			'/api/v1/applications/dockerimage',
			'/api/v1/services'
		].includes(path)
	)
		return undefined;
	const body = (await request.json()) as Record<string, unknown>;
	const common = [
		'project_uuid',
		'environment_uuid',
		'server_uuid',
		'destination_uuid',
		'name',
		'description',
		'instant_deploy'
	];
	const compose = path.endsWith('/services');
	const dockerfile = path.endsWith('/dockerfile');
	const allowed = [
		...common,
		...(compose
			? ['docker_compose_raw']
			: [
					'domains',
					'autogenerate_domain',
					...(dockerfile
						? ['dockerfile']
						: ['docker_registry_image_name', 'docker_registry_image_tag', 'ports_exposes'])
				])
	];
	const invalid = () => Response.json({ message: 'Unexpected creation payload.' }, { status: 422 });
	if (
		Object.keys(body).some((key) => !allowed.includes(key)) ||
		body.project_uuid !== 'project-1' ||
		body.environment_uuid !== 'environment-1' ||
		body.server_uuid !== 'server-1'
	)
		return invalid();
	if (body.destination_uuid && body.destination_uuid !== 'destination-1') return invalid();
	if (typeof body.instant_deploy !== 'boolean') return invalid();
	if (compose || dockerfile) {
		const field = compose ? 'docker_compose_raw' : 'dockerfile';
		const encoded = String(body[field] ?? '');
		const source = Buffer.from(encoded, 'base64').toString('utf8');
		if (
			Buffer.from(source).toString('base64') !== encoded ||
			!source.startsWith(compose ? 'services:' : 'FROM ')
		)
			return invalid();
		if (body.name === 'Reject source')
			return Response.json(
				{
					message: 'Parser found creation-document-secret fragment',
					errors: { [field]: ['creation-document-secret'], name: ['response-creation-secret'] }
				},
				{ status: 422 }
			);
	} else {
		const image = String(body.docker_registry_image_name ?? '');
		if (
			!image ||
			((image.includes('@') || image === 'nginx:stable') && body.docker_registry_image_tag)
		)
			return invalid();
	}
	return Response.json(
		{ uuid: compose ? 'service-created' : 'app-2', secret: 'creation-response-secret' },
		{ status: 201 }
	);
}
