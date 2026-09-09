import { loadResourceIndex } from '$lib/server/resource-index-page';
import { createProject } from '$lib/server/project-actions';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadResourceIndex('projects', setHeaders);
export const actions: Actions = { createProject };
