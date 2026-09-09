import { deployResources } from '$lib/server/deployment-actions';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return {
		breadcrumbs: [
			{ label: 'Deployments', href: '/deployments' },
			{ label: 'New deployment', href: '/deployments/new' }
		]
	};
};
export const actions: Actions = { default: deployResources };
