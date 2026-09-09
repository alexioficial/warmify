import { createResourceActions } from '$lib/server/resource-detail-page';
import { redactApplicationEnvironmentVariables } from '$lib/server/application-environment-variables';
import { getCoolifyClient } from '$lib/server/runtime';
import { databaseFailure } from '$lib/server/database-pages';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
	try {
		return {
			variables: redactApplicationEnvironmentVariables(
				await getCoolifyClient().request(
					'GET',
					`/databases/${encodeURIComponent(params.uuid)}/envs`
				)
			)
		};
	} catch (caught) {
		return { variables: [], requestError: databaseFailure(caught).error };
	}
};
const variableActions = createResourceActions('databases');
export const actions: Actions = {
	createVariable: variableActions.createVariable,
	updateVariable: variableActions.updateVariable,
	deleteVariable: variableActions.deleteVariable,
	bulkVariables: variableActions.bulkVariables
};
