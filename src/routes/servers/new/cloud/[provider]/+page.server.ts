import {
	createCloudServerAction,
	loadCloudServerCreation,
	loadProviderOptionsAction
} from '$lib/server/provider-provisioning';
import { cloudProviderLabel } from '$lib/cloud-security-presenter';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const result = await loadCloudServerCreation(params.provider, setHeaders);
	return {
		...result,
		breadcrumbs: [
			{ label: 'Servers', href: '/servers' },
			{
				label: `New ${cloudProviderLabel(result.provider)} server`,
				href: `/servers/new/cloud/${result.provider}`
			}
		]
	};
};

export const actions: Actions = {
	loadOptions: loadProviderOptionsAction,
	provision: createCloudServerAction
};
