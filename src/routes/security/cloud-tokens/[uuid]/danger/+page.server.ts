import { cloudTokenActions } from '$lib/server/cloud-security-pages';
import type { Actions } from './$types';

export const actions: Actions = { delete: cloudTokenActions.delete };
