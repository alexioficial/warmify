import { createStorageActions } from '$lib/server/application-storage-actions';
import { loadServiceStorages } from '$lib/server/service-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServiceStorages(params.uuid);
export const actions: Actions = createStorageActions('services');
