import { loadHierarchyPage, deleteHierarchy } from '$lib/server/project-actions';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = (event) => loadHierarchyPage(event, 'danger');
export const actions: Actions = { delete: deleteHierarchy };
