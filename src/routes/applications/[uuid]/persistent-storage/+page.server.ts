import { loadApplicationStorages } from '$lib/server/application-pages';
import { createApplicationStorageActions } from '$lib/server/application-storage-actions';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadApplicationStorages(params.uuid);
export const actions: Actions = createApplicationStorageActions();
