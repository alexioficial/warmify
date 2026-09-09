import { describe, expect, test } from 'vitest';

import {
	normalizeApplicationDestinations,
	normalizeApplicationTags,
	normalizeGithubApps,
	normalizeGithubBranches,
	normalizeGithubRepositories,
	normalizeOperationDestinations,
	normalizeOperationEnvironments,
	normalizeRollbackImages
} from './application-operation-presenter';

describe('application operations', () => {
	test('normalizes attached and available destinations without retaining unknown data', () => {
		expect(
			normalizeApplicationDestinations([
				{
					uuid: 'destination-1',
					name: 'Primary',
					network: 'coolify',
					server_uuid: 'server-1',
					is_primary: true,
					password: 'do-not-leak'
				}
			])
		).toEqual([
			{
				uuid: 'destination-1',
				name: 'Primary',
				network: 'coolify',
				serverUuid: 'server-1',
				isPrimary: true
			}
		]);
		expect(
			normalizeOperationDestinations([
				{ uuid: 'destination-2', name: 'Secondary', server: { name: 'Server 2' } }
			])
		).toEqual([{ uuid: 'destination-2', name: 'Secondary', description: 'Server 2' }]);
	});

	test('normalizes rollback images and tags with only actionable metadata', () => {
		expect(
			normalizeRollbackImages({
				current: 'current',
				images: [
					{ tag: 'current', created_at: 'today', is_current: true },
					{ tag: 'previous', created_at: 'yesterday', is_current: false }
				]
			})
		).toEqual({
			current: 'current',
			images: [
				{ tag: 'current', createdAt: 'today', isCurrent: true },
				{ tag: 'previous', createdAt: 'yesterday', isCurrent: false }
			]
		});
		expect(normalizeApplicationTags([{ uuid: 'tag-1', name: 'production' }])).toEqual([
			{ uuid: 'tag-1', name: 'production' }
		]);
	});

	test('builds environment choices from the cached project hierarchy', () => {
		expect(
			normalizeOperationEnvironments([
				{
					uuid: 'project-1',
					name: 'Docs',
					environments: [{ uuid: 'env-1', name: 'production', applications: [] }]
				}
			])
		).toEqual([
			{
				uuid: 'env-1',
				name: 'production',
				description: 'Docs',
				projectUuid: 'project-1',
				projectName: 'Docs'
			}
		]);
	});

	test('normalizes GitHub discovery responses from documented Coolify endpoints', () => {
		expect(
			normalizeGithubApps([{ id: 7, uuid: 'github-1', name: 'widube', client_secret: 'secret' }])
		).toEqual([{ id: '7', uuid: 'github-1', name: 'widube' }]);
		expect(
			normalizeGithubRepositories({
				repositories: [
					{ name: 'api', full_name: 'widube/api' },
					{ name: 'web', owner: { login: 'widube' } }
				]
			})
		).toEqual([
			{ fullName: 'widube/api', name: 'api' },
			{ fullName: 'widube/web', name: 'web' }
		]);
		expect(normalizeGithubBranches({ branches: [{ name: 'main' }, { name: 'develop' }] })).toEqual([
			{ name: 'main' },
			{ name: 'develop' }
		]);
	});
});
