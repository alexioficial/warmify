import {
	createApplicationRollbackActions,
	loadApplicationRollback
} from '$lib/server/application-operations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadApplicationRollback(params.uuid);
export const actions: Actions = createApplicationRollbackActions();
