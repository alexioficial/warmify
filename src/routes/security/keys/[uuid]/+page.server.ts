import { loadPrivateKey, privateKeyActions } from '$lib/server/administration-pages';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadPrivateKey(params.uuid);
};
export const actions: Actions = privateKeyActions;
