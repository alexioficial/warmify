import { describe, expect, test } from 'vitest';

import { loadProjectCollection } from './project-collection';

describe('project collection', () => {
	test('keeps project environments in the cached hierarchy snapshot', async () => {
		const responses = new Map<string, unknown>([
			['/projects', [{ uuid: 'project-1', name: 'Warmify' }]],
			['/projects/project-1/environments', [{ id: 22, uuid: 'env-1', name: 'production' }]],
			['/resources', [{ uuid: 'app-1', environment_id: 22 }]]
		]);
		const client = {
			request: async (_method: string, path: string) => responses.get(path) ?? []
		};

		const projects = await loadProjectCollection(
			client as Parameters<typeof loadProjectCollection>[0]
		);

		expect(projects).toEqual([
			{
				uuid: 'project-1',
				name: 'Warmify',
				environments: [{ id: 22, uuid: 'env-1', name: 'production' }],
				environments_count: 1,
				resources_count: 1
			}
		]);
	});
});
