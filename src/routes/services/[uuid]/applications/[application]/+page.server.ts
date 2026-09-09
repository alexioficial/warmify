import {
	createServiceSubresourceActions,
	loadServiceSubresource
} from '$lib/server/service-subresources';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) =>
	loadServiceSubresource(params.uuid, 'applications', params.application);
export const actions: Actions = createServiceSubresourceActions('applications');
