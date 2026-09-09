import { loadS3Storage } from '$lib/server/s3-storage-pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadS3Storage(params.uuid);
};
