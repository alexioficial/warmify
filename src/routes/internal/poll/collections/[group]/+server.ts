import { error, json } from '@sveltejs/kit';

import { synchronizeCollectionSnapshot } from '$lib/server/inventory-cache';
import { assertInternalUser } from '$lib/server/internal-security';
import { resourceGroups } from '$lib/server/resource-groups';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { params, setHeaders } = event;
	assertInternalUser(event);
	if (!resourceGroups[params.group]) error(404, 'Resource group is not cacheable');
	const snapshot = await synchronizeCollectionSnapshot(params.group);
	setHeaders({
		'cache-control': 'no-store',
		'x-warmify-synchronized-at': String(snapshot.updatedAt)
	});
	return json(snapshot.value);
};
