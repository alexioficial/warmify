import { redirect } from '@sveltejs/kit';

import { firstText, normalizeRecords } from '$lib/resource-presenter';
import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const result = redactSecrets(
		await getCoolifyClient().request(
			'GET',
			`/projects/${encodeURIComponent(params.uuid)}/environments`
		)
	);
	const environments = normalizeRecords(result);
	const environment =
		environments.find((row) => firstText(row, ['name']) === 'production') ?? environments[0];
	if (!environment) redirect(303, `/projects/${encodeURIComponent(params.uuid)}`);
	const environmentUuid = firstText(environment, ['uuid', 'name', 'id']);
	redirect(
		303,
		`/projects/${encodeURIComponent(params.uuid)}/environments/${encodeURIComponent(environmentUuid)}/new`
	);
};
