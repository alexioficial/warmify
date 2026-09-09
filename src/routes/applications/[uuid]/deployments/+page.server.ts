import { loadApplicationRelated } from '$lib/server/application-pages';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => {
	return loadApplicationRelated(params.uuid, '/deployments/applications/{uuid}', 'deployments', {
		query: { take: 50 }
	});
};
