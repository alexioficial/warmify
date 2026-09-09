import { loadApplicationRelated } from '$lib/server/application-pages';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => {
	return loadApplicationRelated(params.uuid, '/applications/{uuid}/logs', 'logs', {
		query: { lines: 100, show_timestamps: false }
	});
};
