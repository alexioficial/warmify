import { createScheduledTaskActions } from '$lib/server/scheduled-task-actions';
import { loadServiceScheduledTasks } from '$lib/server/service-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => loadServiceScheduledTasks(params.uuid);
export const actions: Actions = createScheduledTaskActions('services');
