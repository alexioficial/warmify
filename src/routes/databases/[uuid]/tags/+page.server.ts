import { createDatabaseTagActions, loadDatabaseTags } from '$lib/server/database-operations';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadDatabaseTags(params.uuid);
export const actions: Actions = createDatabaseTagActions();
