import {
	createStorageActions,
	normalizeApplicationStorages,
	normalizeS3StorageOptions
} from '$lib/server/application-storage-actions';
import { getCoolifyClient } from '$lib/server/runtime';
import { databaseFailure } from '$lib/server/database-pages';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
	const [storages, s3] = await Promise.allSettled([
		getCoolifyClient().request('GET', `/databases/${encodeURIComponent(params.uuid)}/storages`),
		getCoolifyClient().request('GET', '/s3-storages')
	]);
	return {
		storages: storages.status === 'fulfilled' ? normalizeApplicationStorages(storages.value) : [],
		s3Storages: s3.status === 'fulfilled' ? normalizeS3StorageOptions(s3.value) : [],
		...(storages.status === 'rejected'
			? { requestError: databaseFailure(storages.reason).error }
			: {}),
		...(s3.status === 'rejected' ? { s3RequestError: databaseFailure(s3.reason).error } : {})
	};
};
export const actions: Actions = createStorageActions('databases');
