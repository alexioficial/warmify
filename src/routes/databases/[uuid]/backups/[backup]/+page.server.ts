import { createDatabaseBackupActions, loadDatabaseBackups } from '$lib/server/database-backups';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadDatabaseBackups(params.uuid, params.backup);
const backupActions = createDatabaseBackupActions();
export const actions = {
	update: backupActions.update,
	run: backupActions.run,
	deleteSchedule: backupActions.deleteSchedule,
	deleteExecution: backupActions.deleteExecution
};
