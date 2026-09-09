import { expect, test, vi } from 'vitest';

vi.mock('./runtime', () => ({ getCoolifyClient: vi.fn() }));

import { searchInventory } from './inventory-search';

test('searches cached collections without persisting a separate index', async () => {
	const load = vi.fn(async (group: string) => ({
		value:
			group === 'applications'
				? [{ uuid: 'app-1', name: 'Documentation', api_token: 'fixture-secret' }]
				: [],
		updatedAt: group === 'projects' ? 10 : 20,
		fromCache: group === 'projects',
		stale: group === 'projects'
	}));

	const result = await searchInventory('documentation', load);

	expect(result.results).toEqual([
		{
			group: 'applications',
			item: { uuid: 'app-1', name: 'Documentation', api_token: '[REDACTED]' }
		}
	]);
	expect(result.sync).toEqual({ updatedAt: 10, fromCache: true, stale: true });
	expect(load).toHaveBeenCalledTimes(6);
});

test('does not search or return a secret value from an unknown field', async () => {
	const load = vi.fn(async () => ({
		value: [{ uuid: 'app-1', name: 'Documentation', nested: { password: 'fixture-secret' } }],
		updatedAt: 20,
		fromCache: false,
		stale: false
	}));

	const result = await searchInventory('fixture-secret', load);

	expect(result.results).toEqual([]);
});

test('an empty query does not load inventory collections', async () => {
	const load = vi.fn();
	expect(await searchInventory(' ', load)).toEqual({ results: [], sync: null });
	expect(load).not.toHaveBeenCalled();
});
