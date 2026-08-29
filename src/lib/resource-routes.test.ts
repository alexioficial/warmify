import { describe, expect, test } from 'vitest';

import { collectionPath, detailPath } from './resource-routes';
import * as resourceRoutes from './resource-routes';

describe('canonical resource routes', () => {
	test.each([
		['projects', '/projects', 'project/one', '/projects/project%2Fone'],
		['applications', '/applications', 'app/one', '/applications/app%2Fone/general'],
		['services', '/services', 'service/one', '/services/service%2Fone'],
		['databases', '/databases', 'database/one', '/databases/database%2Fone'],
		['deployments', '/deployments', 'deployment/one', '/deployments/deployment%2Fone'],
		['servers', '/servers', 'server/one', '/servers/server%2Fone'],
		['destinations', '/destinations', 'destination/one', '/destinations/destination%2Fone'],
		['storage', '/storage', 'storage/one', '/storage/storage%2Fone'],
		['security', '/security/keys', 'key/one', '/security/keys/key%2Fone'],
		['teams', '/teams', 'team/one', '/teams/team%2Fone']
	])('maps %s to an explicit collection and detail route', (group, collection, id, detail) => {
		expect(collectionPath(group)).toBe(collection);
		expect(detailPath(group, id)).toBe(detail);
	});

	test('maps collection-only routes and rejects unknown families', () => {
		expect(collectionPath('sources')).toBe('/sources');
		expect(collectionPath('resources')).toBe('/resources');
		expect(collectionPath('system')).toBe('/system');
		expect(detailPath('sources', 'source-1')).toBeUndefined();
		expect(collectionPath('unknown')).toBeUndefined();
	});

	test('builds API-backed application navigation with resource-specific visibility', () => {
		const applicationNavigation = (
			resourceRoutes as typeof resourceRoutes & {
				applicationNavigation?: (application: unknown) => Array<{
					label: string;
					items: Array<{ slug: string; label: string }>;
				}>;
			}
		).applicationNavigation;
		expect(applicationNavigation).toBeTypeOf('function');
		if (!applicationNavigation) return;

		const gitApplication = applicationNavigation({
			build_pack: 'railpack',
			git_repository: 'widube/warmify'
		});
		const gitSlugs = gitApplication.flatMap((group) => group.items.map((item) => item.slug));
		expect(gitSlugs).toContain('git-source');
		expect(gitSlugs).toContain('preview-deployments');
		expect(gitSlugs).toContain('healthcheck');
		expect(gitSlugs).not.toContain('terminal');
		expect(gitSlugs).not.toContain('metrics');
		expect(gitSlugs).not.toContain('swarm');

		const composeSlugs = applicationNavigation({ build_pack: 'dockercompose' }).flatMap((group) =>
			group.items.map((item) => item.slug)
		);
		expect(composeSlugs).not.toContain('healthcheck');
		expect(composeSlugs).not.toContain('container-image');
		expect(composeSlugs).not.toContain('networking');

		const imageSlugs = applicationNavigation({ build_pack: 'dockerimage' }).flatMap((group) =>
			group.items.map((item) => item.slug)
		);
		expect(imageSlugs).not.toContain('git-source');
		expect(imageSlugs).toContain('preview-deployments');
	});
});
