import { loadApplicationScheduledTasks } from '$lib/server/application-pages';
import { createScheduledTaskActions } from '$lib/server/scheduled-task-actions';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadApplicationScheduledTasks(params.uuid);
export const actions: Actions = createScheduledTaskActions();
