import { s3StorageActions } from '$lib/server/s3-storage-pages';
import type { Actions } from './$types';

export const actions: Actions = {
	update: s3StorageActions.update,
	validate: s3StorageActions.validate
};
