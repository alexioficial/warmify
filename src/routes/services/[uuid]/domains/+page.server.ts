import { createServiceDomainActions } from '$lib/server/service-operations';
import { serviceDomainRows } from '$lib/server/service-operation-presenter';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ parent }) => ({
	rows: serviceDomainRows((await parent()).service)
});
export const actions: Actions = createServiceDomainActions();
