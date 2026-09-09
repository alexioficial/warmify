import { createResourceActions } from '$lib/server/resource-detail-page';
import { loadServiceEnvironmentVariables } from '$lib/server/service-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServiceEnvironmentVariables(params.uuid);
export const actions: Actions = createResourceActions('services');
