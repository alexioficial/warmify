import { loadApplication } from '$lib/server/application-pages';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadApplication(params.uuid);
};
