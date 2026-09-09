import { loadServerSentinel, sentinelActions } from '$lib/server/server-sentinel';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = loadServerSentinel;
export const actions: Actions = sentinelActions;
