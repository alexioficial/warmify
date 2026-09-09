import { loadServerResources } from '$lib/server/server-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServerResources(params.uuid);
