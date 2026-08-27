import { loadApplicationRelated } from '$lib/server/application-pages';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadApplicationRelated(params.uuid, '/applications/{uuid}/logs', 'logs');
