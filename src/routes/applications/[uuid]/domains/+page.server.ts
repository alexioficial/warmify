import { applicationDomainState } from '$lib/server/resource-actions';
import { createResourceActions } from '$lib/server/resource-detail-page';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { application } = await parent();
	return { domainState: applicationDomainState(application) };
};

export const actions: Actions = createResourceActions('applications');
