import {
	loadServerSharedVariables,
	serverSharedVariableActions
} from '$lib/server/shared-variables';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadServerSharedVariables;
export const actions: Actions = serverSharedVariableActions;
