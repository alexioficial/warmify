import { loadS3StorageIndex } from '$lib/server/s3-storage-pages';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadS3StorageIndex(setHeaders);
