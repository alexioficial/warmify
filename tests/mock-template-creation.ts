export async function mockTemplateCreation(request: Request): Promise<Response | undefined> {
	if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/v1/services')
		return undefined;
	const body = (await request.clone().json()) as Record<string, unknown>;
	if (!('type' in body)) return undefined;
	const allowed = [
		'type',
		'project_uuid',
		'environment_uuid',
		'server_uuid',
		'destination_uuid',
		'name',
		'description',
		'tags',
		'instant_deploy',
		'is_container_label_escape_enabled'
	];
	if (
		Object.keys(body).some((key) => !allowed.includes(key)) ||
		body.project_uuid !== 'project-1' ||
		body.environment_uuid !== 'environment-1' ||
		body.server_uuid !== 'server-1'
	)
		return Response.json({ message: 'Invalid template payload.' }, { status: 422 });
	if (body.type !== 'actualbudget')
		return Response.json(
			{
				message: 'template-backend-secret',
				valid_service_types: ['actualbudget', 'gitea-with-mysql']
			},
			{ status: 404 }
		);
	if (body.tags && JSON.stringify(body.tags) !== JSON.stringify(['personal', 'budget']))
		return Response.json({ message: 'Tags must be a deduplicated array.' }, { status: 422 });
	return Response.json(
		{ uuid: 'service-template-created', credentials: 'template-generated-secret' },
		{ status: 201 }
	);
}
