import { describe, expect, test } from 'vitest';

import { configurationBody, newResourceRequest, resourceActionRequest } from './resource-actions';

describe('contextual resource actions', () => {
	test('maps lifecycle actions to allowlisted resource endpoints', () => {
		expect(resourceActionRequest('applications', 'app/1', 'start')).toEqual({
			method: 'POST',
			path: '/applications/app%2F1/start'
		});
		expect(resourceActionRequest('services', 'service-1', 'restart')).toEqual({
			method: 'POST',
			path: '/services/service-1/restart'
		});
		expect(resourceActionRequest('databases', 'db-1', 'stop')).toEqual({
			method: 'POST',
			path: '/databases/db-1/stop'
		});
	});

	test('maps application deploy to the documented deployment endpoint', () => {
		expect(resourceActionRequest('applications', 'app-1', 'deploy')).toEqual({
			method: 'POST',
			path: '/deploy',
			options: { query: { uuid: 'app-1' } }
		});
	});

	test('rejects actions unavailable for a resource family', () => {
		expect(() => resourceActionRequest('servers', 'server-1', 'start')).toThrow(
			'Action is not available'
		);
	});

	test('builds a typed configuration update without empty or unrelated fields', () => {
		const form = new FormData();
		form.set('name', 'Docs');
		form.set('description', 'Documentation');
		form.set('fqdn', '');
		form.set('ignored', 'secret');
		expect(configurationBody(form, ['name', 'description', 'fqdn'])).toEqual({
			name: 'Docs',
			description: 'Documentation',
			fqdn: ''
		});
	});

	test('builds typed create requests for the resource choices shown in the project UI', () => {
		const common = {
			projectUuid: 'project-1',
			serverUuid: 'server-1',
			environmentUuid: 'env-1',
			environmentName: 'production',
			name: 'Docs',
			description: '',
			destinationUuid: '',
			instantDeploy: true
		};
		expect(
			newResourceRequest({
				...common,
				kind: 'public-repository',
				fields: {
					git_repository: 'https://github.com/acme/docs',
					git_branch: 'main',
					build_pack: 'nixpacks'
				}
			})
		).toMatchObject({
			group: 'applications',
			request: {
				method: 'POST',
				path: '/applications/public',
				options: { body: { project_uuid: 'project-1', environment_uuid: 'env-1' } }
			}
		});
		expect(
			newResourceRequest({ ...common, kind: 'database', fields: { engine: 'postgresql' } })
		).toMatchObject({ group: 'databases', request: { path: '/databases/postgresql' } });
		expect(() =>
			newResourceRequest({ ...common, kind: 'database', fields: { engine: 'oracle' } })
		).toThrow('Unsupported database engine');
	});
});
