import { loadApplicationRelated } from '$lib/server/application-pages';
import { createResourceActions } from '$lib/server/resource-detail-page';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadApplicationRelated(params.uuid, '/applications/{uuid}/envs', 'variables');
export const actions: Actions = createResourceActions('applications');
