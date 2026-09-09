import { loadTeamIndex } from '$lib/server/administration-pages';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadTeamIndex(setHeaders);
