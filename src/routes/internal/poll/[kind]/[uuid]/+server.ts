import { error, json } from '@sveltejs/kit';

import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const fixedPaths: Record<string, string> = {
		deployments:
			params.uuid === 'active' ? '/deployments' : `/deployments/${encodeURIComponent(params.uuid)}`,
		'application-logs': `/applications/${encodeURIComponent(params.uuid)}/logs`,
		'service-logs': `/services/${encodeURIComponent(params.uuid)}/logs`,
		'database-logs': `/databases/${encodeURIComponent(params.uuid)}/logs`,
		application: `/applications/${encodeURIComponent(params.uuid)}`,
		service: `/services/${encodeURIComponent(params.uuid)}`,
		database: `/databases/${encodeURIComponent(params.uuid)}`,
		server: `/servers/${encodeURIComponent(params.uuid)}`
	};
	const path = fixedPaths[params.kind];
	if (!path) error(404, 'Polling resource is not allowlisted');
	setHeaders({ 'cache-control': 'no-store' });
	return json(redactSecrets(await getCoolifyClient().request('GET', path)));
};
