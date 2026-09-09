import { loadSource } from '$lib/server/source-pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadSource(params.provider, params.id);
};
