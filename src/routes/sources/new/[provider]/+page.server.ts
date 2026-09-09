import { createSourceAction, loadSourceCreation } from '$lib/server/source-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return loadSourceCreation(params.provider);
};

export const actions: Actions = {
	create: (event) => createSourceAction(event, event.params.provider)
};
