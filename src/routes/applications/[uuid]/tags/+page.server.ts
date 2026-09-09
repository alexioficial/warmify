import {
	createApplicationTagActions,
	loadApplicationTags
} from '$lib/server/application-operations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadApplicationTags(params.uuid);
export const actions: Actions = createApplicationTagActions();
