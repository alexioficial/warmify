import { createDatabaseDangerActions } from '$lib/server/database-operations';
import type { Actions } from './$types';
export const actions: Actions = createDatabaseDangerActions();
