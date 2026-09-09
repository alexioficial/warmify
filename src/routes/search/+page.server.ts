import { searchInventory } from '$lib/server/inventory-search';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const query = url.searchParams.get('q')?.trim() ?? '';
	return { query, ...(await searchInventory(query)) };
};
