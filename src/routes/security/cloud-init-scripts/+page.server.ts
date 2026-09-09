import { loadCloudInitIndex } from '$lib/server/cloud-security-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadCloudInitIndex(setHeaders);
