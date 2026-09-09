import { loadServiceLogs } from '$lib/server/service-pages';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params, url }) =>
	loadServiceLogs(params.uuid, url.searchParams.get('sub_service_name') ?? '');
