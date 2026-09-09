import { loadDeploymentPage, cancelDeployment } from '$lib/server/deployment-detail';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadDeploymentPage(params.uuid);
};
export const actions: Actions = { cancel: cancelDeployment };
