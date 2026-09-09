import { createDatabaseConfigurationActions } from '$lib/server/database-pages';
import type { Actions } from './$types';
export const actions: Actions = createDatabaseConfigurationActions('healthcheck');
