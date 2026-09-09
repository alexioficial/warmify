import { cloudInitActions } from '$lib/server/cloud-security-pages';
import type { Actions } from './$types';

export const actions: Actions = { delete: cloudInitActions.delete };
