import { loadHierarchyPage, updateHierarchy } from '$lib/server/project-actions';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = (event) => loadHierarchyPage(event, 'settings');
export const actions: Actions = { save: updateHierarchy };
