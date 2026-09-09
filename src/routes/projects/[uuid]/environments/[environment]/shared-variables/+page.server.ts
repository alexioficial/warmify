import { loadSharedVariables, sharedVariableActions } from '$lib/server/shared-variables';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadSharedVariables;
export const actions: Actions = sharedVariableActions;
