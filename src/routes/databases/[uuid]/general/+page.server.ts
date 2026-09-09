import { createDatabaseConfigurationActions } from '$lib/server/database-pages';
import type { Actions } from './$types';
import { createResourceActions } from '$lib/server/resource-detail-page';
export const actions: Actions = {
	...createDatabaseConfigurationActions('general'),
	lifecycle: createResourceActions('databases').lifecycle
};
