import { loadGithubRepositories, sourceActions } from '$lib/server/source-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadGithubRepositories(params.id);
export const actions: Actions = { loadBranches: sourceActions.loadBranches };
