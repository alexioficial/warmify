import { loadResourceDetail } from '$lib/server/resource-detail-page';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) =>
	loadResourceDetail('deployments', params.uuid, setHeaders);
