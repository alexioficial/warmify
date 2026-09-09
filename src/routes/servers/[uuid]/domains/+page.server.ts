import { loadServerDomains } from '$lib/server/server-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServerDomains(params.uuid);
