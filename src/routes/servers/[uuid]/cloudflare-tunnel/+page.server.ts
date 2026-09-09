import { loadServerTunnel, tunnelActions } from '$lib/server/server-tunnel';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadServerTunnel;
export const actions: Actions = tunnelActions;
