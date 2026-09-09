import { createApplicationDangerActions } from '$lib/server/application-operations';
import type { Actions } from './$types';

export const actions: Actions = createApplicationDangerActions();
