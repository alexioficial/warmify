import {
	createServiceSubresourceActions,
	loadServiceSubresource
} from '$lib/server/service-subresources';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) =>
	loadServiceSubresource(params.uuid, 'databases', params.database);
export const actions: Actions = createServiceSubresourceActions('databases');
