import { dashboardSnapshotForPage } from '$lib/server/inventory-cache';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await dashboardSnapshotForPage();
		return {
			...snapshot.value,
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			}
		};
	} catch {
		return { projects: [], servers: [], deployments: [], version: null, sync: null };
	}
};
