import { error, json } from '@sveltejs/kit';

import { synchronizeCollection } from '$lib/server/inventory-cache';
import { resourceGroups } from '$lib/server/resource-groups';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	if (!resourceGroups[params.group]) error(404, 'Resource group is not cacheable');
	setHeaders({ 'cache-control': 'no-store' });
	return json(await synchronizeCollection(params.group));
};
