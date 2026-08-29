import { loadResourceIndex } from '$lib/server/resource-index-page';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) =>
	loadResourceIndex('applications', setHeaders);
