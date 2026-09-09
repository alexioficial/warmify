import { redactSecrets } from '$lib/server/redact';
import {
	collectionSnapshotForPage,
	synchronizeCollectionSnapshot,
	type CacheSnapshot
} from '$lib/server/inventory-cache';

export const SEARCHABLE_GROUPS = [
	'projects',
	'applications',
	'services',
	'databases',
	'servers',
	'destinations'
] as const;

export interface InventorySearchResult {
	group: (typeof SEARCHABLE_GROUPS)[number];
	item: Record<string, unknown>;
}

export type InventorySnapshotLoader = (group: string) => Promise<CacheSnapshot<unknown>>;

export async function searchInventory(
	query: string,
	loadSnapshot: InventorySnapshotLoader = collectionSnapshotForPage
) {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return { results: [] as InventorySearchResult[], sync: null };

	const groups = await Promise.all(
		SEARCHABLE_GROUPS.map(async (group) => {
			try {
				return { group, snapshot: await loadSnapshot(group) };
			} catch {
				return null;
			}
		})
	);
	const available = groups.filter((entry) => entry !== null);
	const results = available.flatMap(({ group, snapshot }) =>
		Array.isArray(snapshot.value)
			? snapshot.value.flatMap((item) => {
					const safe = redactSecrets(item);
					if (
						!safe ||
						typeof safe !== 'object' ||
						Array.isArray(safe) ||
						!JSON.stringify(safe).toLowerCase().includes(normalized)
					)
						return [];
					return [{ group, item: safe as Record<string, unknown> }];
				})
			: []
	);
	return {
		results,
		sync: available.length
			? {
					updatedAt: Math.min(...available.map(({ snapshot }) => snapshot.updatedAt)),
					fromCache: available.some(({ snapshot }) => snapshot.fromCache),
					stale: available.some(({ snapshot }) => snapshot.stale)
				}
			: null
	};
}

export function synchronizeInventorySearch(query: string) {
	return searchInventory(query, (group) => synchronizeCollectionSnapshot(group));
}
