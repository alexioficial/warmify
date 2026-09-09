import { json } from '@sveltejs/kit';

import { synchronizeDashboardSnapshot } from '$lib/server/inventory-cache';
import { assertInternalUser } from '$lib/server/internal-security';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { setHeaders } = event;
	assertInternalUser(event);
	const snapshot = await synchronizeDashboardSnapshot();
	setHeaders({
		'cache-control': 'no-store',
		'x-warmify-synchronized-at': String(snapshot.updatedAt)
	});
	return json(snapshot.value);
};
