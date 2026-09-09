import { loadTeamDetail } from '$lib/server/administration-pages';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) =>
	loadTeamDetail(params.uuid, setHeaders);
