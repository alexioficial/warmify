import { loadService } from '$lib/server/service-pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadService(params.uuid);
};
