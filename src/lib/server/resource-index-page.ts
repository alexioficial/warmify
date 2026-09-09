import { error } from '@sveltejs/kit';

import { collectionSnapshotForPage } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';

export async function loadResourceIndex(
	groupName: string,
	setHeaders: (headers: Record<string, string>) => void
) {
	const group = resourceGroups[groupName];
	if (!group) error(404, 'Resource group not found');
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage(groupName);
		return {
			group: groupName,
			...group,
			data: redactSecrets(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			}
		};
	} catch (caught) {
		return {
			group: groupName,
			...group,
			data: [],
			sync: null,
			requestError: caught instanceof Error ? caught.message : 'Coolify request failed'
		};
	}
}
