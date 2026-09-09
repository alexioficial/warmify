import { destinationActions } from '$lib/server/destinations';
import type { Actions } from './$types';

export const actions: Actions = { delete: destinationActions.delete };
