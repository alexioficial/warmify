import { json } from '@sveltejs/kit';

import { synchronizeDashboard } from '$lib/server/inventory-cache';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return json(await synchronizeDashboard());
};
