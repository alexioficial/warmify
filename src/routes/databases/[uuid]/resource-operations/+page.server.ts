import { loadApplicationOperationOptions } from '$lib/server/application-operations';
import { createDatabaseOperationActions } from '$lib/server/database-operations';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = () => loadApplicationOperationOptions();
export const actions: Actions = createDatabaseOperationActions();
