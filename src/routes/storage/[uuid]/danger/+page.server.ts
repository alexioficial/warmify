import { s3StorageActions } from '$lib/server/s3-storage-pages';
import type { Actions } from './$types';

export const actions: Actions = { delete: s3StorageActions.delete };
