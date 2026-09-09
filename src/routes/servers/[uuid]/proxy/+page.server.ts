import { loadServerProxy, proxyActions } from '$lib/server/server-proxy';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadServerProxy;
export const actions: Actions = proxyActions;
