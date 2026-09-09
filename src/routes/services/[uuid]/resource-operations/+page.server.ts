import { loadApplicationOperationOptions } from '$lib/server/application-operations';
import { createServiceOperationActions } from '$lib/server/service-operations';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = () => loadApplicationOperationOptions();
export const actions: Actions = createServiceOperationActions();
