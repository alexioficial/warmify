import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));
import { deployResources, deploymentSubmission, deploymentOutcomes } from './deployment-actions';
import { CoolifyError } from './coolify-client';
function form(values: Record<string, string | undefined>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values))
		if (value !== undefined) result.set(key, value);
	return result;
}
function event(values: Record<string, string | undefined>) {
	return {
		locals: { user: { username: 'admin' } },
		url: new URL('http://localhost/deployments/new'),
		request: new Request('http://localhost/deployments/new', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form(values)
		})
	} as unknown as RequestEvent;
}
beforeEach(() => {
	request
		.mockReset()
		.mockResolvedValue({ deployments: [{ resource_uuid: 'app-1', deployment_uuid: 'd-1' }] });
	invalidate.mockReset();
});
test('UUID submission deduplicates targets and emits only supported JSON fields', () => {
	const result = deploymentSubmission(
		form({
			mode: 'uuid',
			targets: 'app-1, app-1, app-2',
			force: 'true',
			pull_request_id: '12',
			docker_tag: 'preview-12',
			token: 'hidden'
		})
	);
	expect(result.body).toEqual({
		uuid: 'app-1,app-2',
		force: true,
		pull_request_id: 12,
		docker_tag: 'preview-12'
	});
	expect(result.fieldErrors).toEqual({});
	expect(JSON.stringify(result.values)).not.toContain('hidden');
});
test('tag deployment omits UUID and blank optional fields', () => {
	expect(
		deploymentSubmission(
			form({ mode: 'tag', targets: 'Web apps, production', pull_request_id: '', docker_tag: '' })
		).body
	).toEqual({ tag: 'Web apps,production' });
});
test.each([
	{ mode: 'other', targets: 'app-1' },
	{ mode: 'uuid', targets: ', ,' },
	{ mode: 'uuid', targets: '../app-1' },
	{ mode: 'tag', targets: 'prod\nother' },
	{ mode: 'tag', targets: 'prod', pull_request_id: '12' },
	{ mode: 'uuid', targets: 'app-1', pull_request_id: '-1' },
	{ mode: 'uuid', targets: 'app-1', pull_request_id: '1.5' },
	{ mode: 'uuid', targets: 'app-1', docker_tag: 'latest' },
	{ mode: 'uuid', targets: 'app-1', pull_request_id: '12', docker_tag: 'bad/tag' },
	{ mode: 'uuid', targets: 'app-1', force: 'anything' }
])('invalid input is refused before the API: %j', async (values) => {
	const result = await deployResources(event({ ...values, confirmation: 'confirm' }));
	expect(result).toMatchObject({ status: 400, data: { fieldErrors: expect.any(Object) } });
	expect(request).not.toHaveBeenCalled();
});
test.each(['auth', 'origin', 'confirmation'])('deploy requires %s', async (kind) => {
	const input = event({
		mode: 'uuid',
		targets: 'app-1',
		confirmation: kind === 'confirmation' ? '' : 'confirm'
	});
	if (kind === 'auth') input.locals.user = null;
	if (kind === 'origin') input.request.headers.set('origin', 'https://other.test');
	expect(await deployResources(input)).toMatchObject({
		status: kind === 'auth' ? 401 : kind === 'origin' ? 403 : 400
	});
	expect(request).not.toHaveBeenCalled();
});
test('one POST deploys, does not forward form claims, invalidates inventory and returns safe references', async () => {
	const result = await deployResources(
		event({
			mode: 'uuid',
			targets: 'app-1',
			confirmation: 'confirm',
			tag: 'foreign',
			operationId: 'DELETE:/applications/app-1'
		})
	);
	expect(request.mock.calls).toEqual([['POST', '/deploy', { body: { uuid: 'app-1' } }]]);
	expect(result).toMatchObject({
		outcomes: [{ resourceUuid: 'app-1', deploymentUuid: 'd-1', outcome: 'reference' }]
	});
	expect(invalidate).toHaveBeenCalledWith('deployments');
});
test('UUID outcomes distinguish absent, rejected, skipped and started targets without leaking messages', () => {
	const result = deploymentOutcomes(
		{
			deployments: [
				{ resource_uuid: 'app-1', deployment_uuid: 'd-1', message: 'secret-1' },
				{ resource_uuid: 'app-2', message: 'Unauthorized to deploy this application. secret-2' },
				{ resource_uuid: 'app-3', message: 'Deployment skipped: secret-3' },
				{
					resource_uuid: 'service-1',
					message: 'Service secret-4 started. It could take a while, be patient.'
				}
			]
		},
		['app-1', 'app-2', 'app-3', 'service-1', 'absent']
	);
	expect(result.map((row) => row.outcome)).toEqual([
		'reference',
		'rejected',
		'skipped',
		'started',
		'missing'
	]);
	expect(result.at(-1)?.resourceUuid).toBe('absent');
	expect(JSON.stringify(result)).not.toContain('secret-');
});
test('tag response uses details and never fabricates a deployment from top-level messages', () => {
	expect(
		deploymentOutcomes({
			message: ['private-backend-output'],
			details: [{ resource_uuid: 'a1', deployment_uuid: 'd1' }]
		})
	).toEqual([{ resourceUuid: 'a1', deploymentUuid: 'd1', outcome: 'reference' }]);
	expect(deploymentOutcomes({ message: ['Service started'] })).toEqual([]);
});
test('duplicate deployment refusal never links an unused UUID, and names do not imply failure', () => {
	expect(
		deploymentOutcomes({
			deployments: [
				{
					resource_uuid: 'app-1',
					deployment_uuid: 'not-created',
					message: 'Deployment already queued for this commit.'
				},
				{
					resource_uuid: 'app-2',
					deployment_uuid: 'd2',
					message: 'Application failed-checker deployment queued.'
				},
				{
					resource_uuid: 'service-1',
					message: 'Service skipped-test started. It could take a while, be patient.'
				}
			]
		})
	).toEqual([
		{ resourceUuid: 'app-1', deploymentUuid: '', outcome: 'skipped' },
		{ resourceUuid: 'app-2', deploymentUuid: 'd2', outcome: 'reference' },
		{ resourceUuid: 'service-1', deploymentUuid: '', outcome: 'started' }
	]);
});
test('rate limits after a partially processed request are never retried and preserve safe input', async () => {
	request.mockRejectedValue(new CoolifyError('server-command-secret', 429, {}, 60));
	const result = await deployResources(
		event({ mode: 'uuid', targets: 'app-1,app-2', confirmation: 'confirm' })
	);
	expect(result).toMatchObject({
		status: 429,
		data: { uncertain: true, retryAfterSeconds: 60, values: { targets: 'app-1,app-2' } }
	});
	expect(request).toHaveBeenCalledTimes(1);
	expect(invalidate).toHaveBeenCalledWith('deployments');
	expect(JSON.stringify(result)).not.toContain('server-command-secret');
});
