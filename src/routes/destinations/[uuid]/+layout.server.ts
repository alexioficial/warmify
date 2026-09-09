import { loadDestination } from '$lib/server/destinations';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadDestination(params.uuid);
};
