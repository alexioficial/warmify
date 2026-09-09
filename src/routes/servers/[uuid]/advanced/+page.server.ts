import { serverActions } from '$lib/server/server-pages';
import type { Actions } from './$types';

export const actions: Actions = { updateAdvanced: serverActions.updateAdvanced };
