import { createResourceActions } from '$lib/server/resource-detail-page';
import { loadGitSourceDiscovery } from '$lib/server/application-operations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => loadGitSourceDiscovery(url);
export const actions: Actions = createResourceActions('applications');
