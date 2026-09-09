import { expect, test } from 'vitest';
import { deploymentCollection } from './deployment-presenter';
test('nested server and environment names survive without carrying their configuration', () => {
	expect(
		deploymentCollection([
			{
				deployment_uuid: 'd1',
				server: { name: 'Primary server', password: 'secret' },
				environment: { name: 'production', envs: [{ value: 'secret' }] }
			}
		])
	).toEqual([
		{ deployment_uuid: 'd1', server_name: 'Primary server', environment_name: 'production' }
	]);
});
test('numeric-key active responses retain metadata but never logs or snapshots', () => {
	const result = deploymentCollection({
		3: {
			id: 3,
			deployment_uuid: 'd3',
			application_id: 2,
			application_name: 'Web',
			status: 'queued',
			configuration_snapshot: { value: 'snapshot-secret' },
			logs: 'log-secret'
		},
		8: { id: 8, deployment_uuid: 'd8', status: 'in_progress', token: 'token-secret' }
	});
	expect(result).toMatchObject([
		{ deployment_uuid: 'd3', application_id: 2, status: 'queued' },
		{ deployment_uuid: 'd8', status: 'in_progress' }
	]);
	expect(JSON.stringify(result)).not.toMatch(/secret|snapshot|logs|token/);
});
test('collection wrappers work and numeric IDs never masquerade as deployment UUIDs', () => {
	expect(
		deploymentCollection({ deployments: [{ id: 7 }, { deployment_uuid: 'd1', status: 'queued' }] })
	).toEqual([{ deployment_uuid: 'd1', status: 'queued' }]);
	expect(deploymentCollection({ message: 'error', token: 'secret' })).toEqual([]);
});
