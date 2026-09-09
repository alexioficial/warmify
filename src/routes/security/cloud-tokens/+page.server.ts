import { loadCloudTokenIndex } from '$lib/server/cloud-security-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadCloudTokenIndex(setHeaders);
