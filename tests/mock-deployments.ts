const detailReads = new Map<string, number>();
const cancelled = new Set<string>();
export async function mockDeployments(request: Request): Promise<Response | undefined> {
	const path = new URL(request.url).pathname;
	if (request.method === 'GET' && path === '/api/v1/applications')
		return Response.json([{ id: 7, uuid: 'app-2', name: 'Image App', environment_id: 1 }]);
	const detail = path.match(
		/^\/api\/v1\/deployments\/(detail-(?:live|failed|cancel|hidden))(\/cancel)?$/
	);
	if (detail) {
		const uuid = detail[1];
		if (request.method === 'POST' && detail[2]) {
			if (request.headers.has('content-type') || cancelled.has(uuid))
				return Response.json({ message: 'unexpected-cancel-body' }, { status: 400 });
			cancelled.add(uuid);
			return Response.json({ deployment_uuid: uuid, status: 'cancelled-by-user' });
		}
		if (request.method === 'GET' && !detail[2]) {
			const reads = (detailReads.get(uuid) ?? 0) + 1;
			detailReads.set(uuid, reads);
			const status = cancelled.has(uuid)
				? 'cancelled-by-user'
				: uuid === 'detail-cancel' || uuid === 'detail-hidden'
					? 'in_progress'
					: reads === 1
						? 'queued'
						: uuid === 'detail-failed'
							? 'failed'
							: reads === 2
								? 'in_progress'
								: 'finished';
			return Response.json({
				deployment_uuid: uuid,
				application_id: 7,
				application_name: 'Image App',
				status,
				server_name: 'Primary server',
				commit: '1234567',
				commit_message: 'Update image',
				created_at: '2026-09-04T10:00:00Z',
				finished_at: ['finished', 'failed', 'cancelled-by-user'].includes(status)
					? '2026-09-04T10:01:00Z'
					: null,
				configuration_snapshot: { value: 'deployment-snapshot-secret' },
				logs: JSON.stringify([
					{ output: `Status: ${status}`, command: 'deployment-command-secret' },
					{ output: 'deployment-hidden-secret', hidden: true }
				])
			});
		}
	}
	if (request.method !== 'POST' || path !== '/api/v1/deploy') return;
	const body = (await request.json()) as Record<string, unknown>;
	const allowed = ['uuid', 'tag', 'force', 'pull_request_id', 'docker_tag'];
	if (
		Object.keys(body).some((key) => !allowed.includes(key)) ||
		Boolean(body.uuid) === Boolean(body.tag)
	)
		return Response.json({ message: 'Unexpected deployment payload' }, { status: 422 });
	if (body.uuid === 'limited')
		return Response.json(
			{ message: 'deployment-backend-secret' },
			{ status: 429, headers: { 'retry-after': '60' } }
		);
	if (
		body.uuid === 'app-2,missing-app' &&
		body.pull_request_id === 12 &&
		body.docker_tag === 'preview-12' &&
		body.force === true
	)
		return Response.json({
			deployments: [
				{
					resource_uuid: 'app-2',
					deployment_uuid: 'app-deploy-active',
					message: 'deployment-result-secret'
				}
			]
		});
	if (body.tag === 'production,web' && !('pull_request_id' in body) && !('docker_tag' in body))
		return Response.json({
			message: ['deployment-result-secret'],
			details: [{ resource_uuid: 'app-2', deployment_uuid: 'app-deploy-active' }]
		});
	return Response.json({ message: 'Unexpected deployment targets or options' }, { status: 422 });
}
