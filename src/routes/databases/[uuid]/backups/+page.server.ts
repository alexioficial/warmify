import { createDatabaseBackupActions, loadDatabaseBackups } from '$lib/server/database-backups';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ params }) => loadDatabaseBackups(params.uuid);
export const actions = { create: createDatabaseBackupActions().create };
