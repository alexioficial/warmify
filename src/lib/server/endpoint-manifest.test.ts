import { describe, expect, it } from 'vitest';

import { buildEndpointRequest, endpointManifest, getEndpoint } from './endpoint-manifest';

describe('endpoint manifest', () => {
	it('freezes the complete documented Coolify surface by resource group', () => {
		expect(endpointManifest.length).toBeGreaterThan(180);
		for (const group of [
			'applications',
			'databases',
			'deployments',
			'projects',
			'servers',
			'services',
			'system',
			'teams'
		]) {
			expect(
				endpointManifest.some((endpoint) => endpoint.group === group),
				group
			).toBe(true);
		}
		expect(new Set(endpointManifest.map((endpoint) => endpoint.id)).size).toBe(
			endpointManifest.length
		);
	});

	it('resolves only registered operations', () => {
		expect(getEndpoint('GET:/projects').path).toBe('/projects');
		expect(() => getEndpoint('GET:/not-allowlisted')).toThrow('not allowlisted');
	});

	it('encodes every required path parameter', () => {
		const endpoint = getEndpoint('GET:/projects/{uuid}/{environment_name_or_uuid}');
		expect(
			buildEndpointRequest(endpoint, {
				uuid: 'project/one',
				environment_name_or_uuid: 'production'
			})
		).toEqual({
			method: 'GET',
			path: '/projects/project%2Fone/production'
		});
		expect(() => buildEndpointRequest(endpoint, { uuid: 'project-one' })).toThrow(
			'environment_name_or_uuid'
		);
	});

	it('allowlists every public application capability in the frozen matrix', () => {
		const applicationOperations = [
			'GET:/applications',
			'POST:/applications/public',
			'POST:/applications/private-github-app',
			'POST:/applications/private-deploy-key',
			'POST:/applications/dockerfile',
			'POST:/applications/dockerimage',
			'GET:/applications/{uuid}',
			'PATCH:/applications/{uuid}',
			'DELETE:/applications/{uuid}',
			'GET:/applications/{uuid}/logs',
			'GET:/applications/{uuid}/envs',
			'POST:/applications/{uuid}/envs',
			'PATCH:/applications/{uuid}/envs',
			'PATCH:/applications/{uuid}/envs/bulk',
			'DELETE:/applications/{uuid}/envs/{env_uuid}',
			'POST:/applications/{uuid}/start',
			'POST:/applications/{uuid}/stop',
			'POST:/applications/{uuid}/restart',
			'POST:/applications/{uuid}/move',
			'POST:/applications/{uuid}/migrate',
			'POST:/applications/{uuid}/clone',
			'GET:/applications/{uuid}/storages',
			'POST:/applications/{uuid}/storages',
			'PATCH:/applications/{uuid}/storages',
			'DELETE:/applications/{uuid}/storages/{storage_uuid}',
			'PUT:/applications/{uuid}/storages/{storage_uuid}/backups',
			'POST:/applications/{uuid}/storages/{storage_uuid}/backups/run',
			'DELETE:/applications/{uuid}/storages/{storage_uuid}/backups',
			'DELETE:/applications/{uuid}/previews/{pull_request_id}',
			'GET:/applications/{uuid}/tags',
			'POST:/applications/{uuid}/tags',
			'DELETE:/applications/{uuid}/tags/{tag_uuid}',
			'GET:/applications/{uuid}/rollback-images',
			'POST:/applications/{uuid}/rollback',
			'GET:/applications/{uuid}/destinations',
			'POST:/applications/{uuid}/destinations',
			'DELETE:/applications/{uuid}/destinations/{destination_uuid}',
			'GET:/applications/{uuid}/scheduled-tasks',
			'POST:/applications/{uuid}/scheduled-tasks',
			'PATCH:/applications/{uuid}/scheduled-tasks/{task_uuid}',
			'DELETE:/applications/{uuid}/scheduled-tasks/{task_uuid}',
			'GET:/applications/{uuid}/scheduled-tasks/{task_uuid}/executions',
			'POST:/applications/{uuid}/scheduled-tasks/{task_uuid}/execute',
			'GET:/deployments/applications/{uuid}',
			'GET:/deployments/{uuid}',
			'POST:/deployments/{uuid}/cancel'
		];

		for (const operation of applicationOperations) {
			expect(getEndpoint(operation).id, operation).toBe(operation);
		}
	});

	it('classifies backup schedule replacement as a write operation', () => {
		const endpoint = getEndpoint('PUT:/applications/{uuid}/storages/{storage_uuid}/backups');
		expect(endpoint.method).toBe('PUT');
		expect(endpoint.risk).toBe('write');
		expect(
			buildEndpointRequest(
				endpoint,
				{ uuid: 'app-one', storage_uuid: 'storage-one' },
				{ body: { frequency: '0 2 * * *' } }
			)
		).toEqual({
			method: 'PUT',
			path: '/applications/app-one/storages/storage-one/backups',
			options: { body: { frequency: '0 2 * * *' } }
		});
	});
});
