import { createS3Storage } from '$lib/server/s3-storage-pages';
import type { Actions } from './$types';

export const actions: Actions = { create: createS3Storage };
