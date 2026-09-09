import { loadSourcesIndex } from '$lib/server/source-pages';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadSourcesIndex(setHeaders);
