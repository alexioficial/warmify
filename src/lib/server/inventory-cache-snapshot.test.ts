import { beforeEach, expect, test, vi } from 'vitest';

const cache = vi.hoisted(() => new Map<string, { value: unknown; updatedAt: number }>());
const request = vi.hoisted(() => vi.fn());

vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }) }));
vi.mock('./cache-database', () => ({
	readCache: (key: string) => cache.get(key),
	writeCache: (key: string, value: unknown) => {
		cache.set(key, { value, updatedAt: Date.now() });
	},
	deleteCache: (key: string) => cache.delete(key)
}));

import {
	CACHE_STALE_MS,
	collectionSnapshotForPage,
	synchronizeCollectionSnapshot
} from './inventory-cache';

beforeEach(() => {
	cache.clear();
	request.mockReset();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
});

test('returns cached collection metadata immediately and refreshes it in the background', async () => {
	const updatedAt = Date.now() - CACHE_STALE_MS - 1;
	cache.set('collection:servers', { value: [{ uuid: 'cached-server' }], updatedAt });
	request.mockResolvedValue([{ uuid: 'fresh-server' }]);

	const snapshot = await collectionSnapshotForPage('servers');

	expect(snapshot).toEqual({
		value: [{ uuid: 'cached-server' }],
		updatedAt,
		fromCache: true,
		stale: true
	});
	await vi.waitFor(() =>
		expect(cache.get('collection:servers')?.value).toEqual([{ uuid: 'fresh-server' }])
	);
});

test('returns a fresh snapshot when the cache is empty', async () => {
	request.mockResolvedValue([{ uuid: 'server-1' }]);

	const snapshot = await collectionSnapshotForPage('servers');

	expect(snapshot).toEqual({
		value: [{ uuid: 'server-1' }],
		updatedAt: Date.now(),
		fromCache: false,
		stale: false
	});
});

test('synchronized snapshots expose the timestamp written with the refreshed value', async () => {
	request.mockResolvedValue([{ uuid: 'server-2' }]);

	const snapshot = await synchronizeCollectionSnapshot('servers');

	expect(snapshot).toEqual({
		value: [{ uuid: 'server-2' }],
		updatedAt: Date.now(),
		fromCache: false,
		stale: false
	});
});
