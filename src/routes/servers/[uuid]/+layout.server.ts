import { loadServer } from '$lib/server/server-pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadServer(params.uuid);
};
