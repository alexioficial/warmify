import { createDestinationAction, loadServerDestinations } from '$lib/server/destinations';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServerDestinations(params.uuid);
export const actions: Actions = { createDestination: createDestinationAction };
