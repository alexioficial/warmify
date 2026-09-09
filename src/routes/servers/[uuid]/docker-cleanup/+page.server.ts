import { dockerCleanupActions, loadDockerCleanup } from '$lib/server/server-docker-cleanup';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = loadDockerCleanup;
export const actions: Actions = dockerCleanupActions;
