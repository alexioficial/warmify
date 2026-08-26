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
});
