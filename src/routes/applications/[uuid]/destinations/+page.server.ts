import {
	createApplicationDestinationActions,
	loadApplicationDestinations
} from '$lib/server/application-operations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadApplicationDestinations(params.uuid);
export const actions: Actions = createApplicationDestinationActions();
