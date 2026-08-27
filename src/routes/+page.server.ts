import { dashboardForPage } from '$lib/server/inventory-cache';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return await dashboardForPage();
	} catch {
		return { projects: [], servers: [], deployments: [], version: null };
	}
};
