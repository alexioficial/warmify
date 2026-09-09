import {
	createApplicationResourceOperationActions,
	loadApplicationOperationOptions
} from '$lib/server/application-operations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => loadApplicationOperationOptions();
export const actions: Actions = createApplicationResourceOperationActions();
