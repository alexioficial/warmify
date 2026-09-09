import { loadSystemPage, systemActions } from '$lib/server/system-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => loadSystemPage(setHeaders);
export const actions = systemActions satisfies Actions;
