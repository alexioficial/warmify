import { createResourceActions, loadResourceDetail } from '$lib/server/resource-detail-page';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) =>
	loadResourceDetail('databases', params.uuid, setHeaders);
export const actions: Actions = createResourceActions('databases');
