import { loadCloudToken } from '$lib/server/cloud-security-pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadCloudToken(params.uuid);
};
