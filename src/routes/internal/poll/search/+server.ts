import { json } from '@sveltejs/kit';

import { synchronizeInventorySearch } from '$lib/server/inventory-search';
import { assertInternalUser, boundedSearchQuery } from '$lib/server/internal-security';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { url, setHeaders } = event;
	assertInternalUser(event);
	const query = boundedSearchQuery(url.searchParams.get('q') ?? '');
	const result = await synchronizeInventorySearch(query);
	setHeaders({
		'cache-control': 'no-store',
		...(result.sync ? { 'x-warmify-synchronized-at': String(result.sync.updatedAt) } : {})
	});
	return json(result.results);
};
