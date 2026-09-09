import { createServerAction, loadServerCreation } from '$lib/server/server-creation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadServerCreation(setHeaders);
export const actions: Actions = { createServer: createServerAction };
