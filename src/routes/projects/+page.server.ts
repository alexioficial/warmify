import { createIndexActions, loadResourceIndex } from '$lib/server/resource-index-page';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadResourceIndex('projects', setHeaders);
export const actions: Actions = createIndexActions('projects');
