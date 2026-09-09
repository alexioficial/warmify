import { loadApplicationEnvironmentVariables } from '$lib/server/application-pages';
import { createResourceActions } from '$lib/server/resource-detail-page';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) =>
	loadApplicationEnvironmentVariables(params.uuid);
export const actions: Actions = createResourceActions('applications');
