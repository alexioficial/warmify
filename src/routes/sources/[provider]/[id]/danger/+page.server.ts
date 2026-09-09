import { sourceActions } from '$lib/server/source-pages';
import type { Actions } from './$types';

export const actions: Actions = { delete: sourceActions.delete };
