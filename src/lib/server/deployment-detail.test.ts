import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const request = vi.hoisted(() => vi.fn());
const collection = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({
	collectionForPage: collection,
	invalidateCollection: vi.fn()
}));
import {
	cancelDeployment,
	deploymentContext,
	deploymentLogs,
	deploymentSnapshot,
	loadDeploymentPage
} from './deployment-detail';
import { CoolifyError } from './coolify-client';
const projects = [
	{ uuid: 'p1', name: 'Project', environments: [{ uuid: 'e1', id: 8, name: 'production' }] }
];
const apps = [{ id: 7, uuid: 'a1', name: 'App', environment_id: 8, token: 'app-secret' }];
function event(confirmed = true) {
	const body = new FormData();
	if (confirmed) body.set('confirmation', 'confirm');
	body.set('uuid', 'forged');
	return {
		params: { uuid: 'd1' },
		locals: { user: { username: 'admin' } },
		url: new URL('http://localhost/deployments/d1'),
		request: new Request('http://localhost/deployments/d1', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body
		})
	} as unknown as RequestEvent;
}
beforeEach(() => {
	request
		.mockReset()
		.mockImplementation(async (method) =>
			method === 'GET'
				? { deployment_uuid: 'd1', application_id: 7, status: 'queued', logs: 'Ready' }
				: { deployment_uuid: 'd1', status: 'cancelled-by-user' }
		);
	collection
		.mockReset()
		.mockImplementation(async (group) => (group === 'projects' ? projects : apps));
});
test('detail rejects a mismatched deployment before exposing any data', () => {
	expect(() => deploymentSnapshot({ deployment_uuid: 'foreign', logs: 'secret' }, 'd1')).toThrow();
});
test('logs parse JSON, skip hidden entries/commands and mask recognizable credentials', () => {
	const logs = deploymentLogs(
		JSON.stringify([
			{ output: 'password=secret-1', timestamp: '2026-09-04T00:00:00Z', command: 'command-secret' },
			{ output: 'hidden-secret', hidden: true },
			{ output: 'hidden-secret-2', hidden: '1' },
			{ output: 'Connecting https://user:secret-2@example.test Authorization: Bearer secret-3' },
			{ content: 'unknown-secret' }
		])
	);
	expect(logs.available).toBe(true);
	expect(logs.text).toContain('Connecting');
	expect(logs.text).toContain('[REDACTED]');
	expect(logs.text).not.toMatch(/secret-|hidden-secret|command-secret|unknown-secret/);
});
test('logs distinguish no permission, empty output, malformed JSON and bounded tails', () => {
	expect(deploymentLogs(undefined)).toMatchObject({ available: false, text: '' });
	expect(deploymentLogs('[]')).toMatchObject({ available: true, text: '' });
	expect(deploymentLogs('{"token":"secret"')).toMatchObject({ available: false, text: '' });
	expect(deploymentLogs('x'.repeat(210000))).toMatchObject({ available: true, truncated: true });
	expect(deploymentLogs('x'.repeat(210000)).text.length).toBeLessThanOrEqual(200000);
});
test('numeric application ID resolves to physical UUID hierarchy without exposing records', () => {
	expect(deploymentContext({ application_id: 7 }, apps, projects)).toEqual([
		{ label: 'Projects', href: '/projects' },
		{ label: 'Project', href: '/projects/p1' },
		{ label: 'production', href: '/projects/p1/environments/e1' },
		{ label: 'App', href: '/applications/a1/general' },
		{ label: 'Application deployments', href: '/applications/a1/deployments' }
	]);
	expect(deploymentContext({ application_id: 99 }, apps, projects)).toEqual([]);
	expect(
		deploymentContext({ application_uuid: 'foreign', application_id: 7 }, apps, projects)
	).toEqual([]);
});
test('page contains only metadata/log output and uses no detail cache', async () => {
	request.mockResolvedValue({
		deployment_uuid: 'd1',
		application_id: 7,
		status: 'queued',
		logs: JSON.stringify([{ output: 'Build ready', command: 'private-command' }]),
		configuration_snapshot: { password: 'snapshot-secret' }
	});
	const result = await loadDeploymentPage('d1');
	expect(result.context.at(-2)?.href).toBe('/applications/a1/general');
	expect(result.logs.text).toBe('Build ready');
	expect(JSON.stringify(result)).not.toMatch(/snapshot-secret|app-secret|private-command/);
	expect(request).toHaveBeenCalledWith('GET', '/deployments/d1');
});
test('missing context collections do not break the deployment detail', async () => {
	collection.mockRejectedValue(new Error('private-api-error'));
	expect(await loadDeploymentPage('d1')).toMatchObject({ context: [], logs: { text: 'Ready' } });
});
test.each(['queued', 'in_progress'])(
	'confirmed %s cancellation posts exactly once to route identity',
	async (status) => {
		request.mockImplementation(async (method) =>
			method === 'GET'
				? { deployment_uuid: 'd1', status }
				: { deployment_uuid: 'd1', status: 'cancelled-by-user' }
		);
		await expect(cancelDeployment(event())).rejects.toMatchObject({
			status: 303,
			location: '/deployments/d1'
		});
		expect(request.mock.calls).toEqual([
			['GET', '/deployments/d1'],
			['POST', '/deployments/d1/cancel']
		]);
	}
);
test.each(['finished', 'failed', 'cancelled-by-user', 'unknown'])(
	'terminal/unknown %s cannot be cancelled',
	async (status) => {
		request.mockResolvedValue({ deployment_uuid: 'd1', status });
		expect(await cancelDeployment(event())).toMatchObject({ status: 400 });
		expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
	}
);
test.each(['auth', 'origin', 'confirmation', 'identity'])(
	'invalid %s cannot cancel',
	async (kind) => {
		const input = event(kind !== 'confirmation');
		if (kind === 'auth') input.locals.user = null;
		if (kind === 'origin') input.request.headers.set('origin', 'https://other.test');
		if (kind === 'identity')
			request.mockResolvedValue({ deployment_uuid: 'foreign', status: 'queued' });
		expect(await cancelDeployment(input)).toMatchObject({
			status: kind === 'auth' ? 401 : kind === 'origin' ? 403 : kind === 'identity' ? 404 : 400
		});
		expect(request.mock.calls.some(([method]) => method === 'POST')).toBe(false);
	}
);
test('a cancellation race refusal is safe and never retried', async () => {
	request.mockImplementation(async (method) => {
		if (method === 'POST') throw new CoolifyError('shell-secret', 400);
		return { deployment_uuid: 'd1', status: 'queued' };
	});
	const result = await cancelDeployment(event());
	expect(result).toMatchObject({ status: 400 });
	expect(JSON.stringify(result)).not.toContain('shell-secret');
	expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1);
});
