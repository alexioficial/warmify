import { loadServerLogDrains, logDrainActions } from '$lib/server/server-log-drains';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadServerLogDrains;
export const actions: Actions = logDrainActions;
