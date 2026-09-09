import { collectionForPage } from '$lib/server/inventory-cache';
import { deploymentCollection } from '$lib/server/deployment-presenter';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return { deployments: deploymentCollection(await collectionForPage('deployments')) };
	} catch {
		return { deployments: [], requestError: 'Deployment activity could not be loaded.' };
	}
};
