import { createServiceTagActions, loadServiceTags } from '$lib/server/service-operations';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadServiceTags(params.uuid);
export const actions: Actions = createServiceTagActions();
