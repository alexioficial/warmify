import { describe, expect, test } from 'vitest';

import { collectionPath, detailPath } from './resource-routes';

describe('canonical resource routes', () => {
	test.each([
		['projects', '/projects', 'project/one', '/projects/project%2Fone'],
		['applications', '/applications', 'app/one', '/applications/app%2Fone'],
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
});
