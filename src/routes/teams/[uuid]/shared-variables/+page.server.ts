import { loadTeamSharedVariables, teamSharedVariableActions } from '$lib/server/shared-variables';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadTeamSharedVariables;
export const actions: Actions = teamSharedVariableActions;
