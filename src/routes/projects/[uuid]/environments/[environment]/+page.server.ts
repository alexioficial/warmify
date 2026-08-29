import { error } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const projectUuid = encodeURIComponent(params.uuid);
	const environmentUuid = encodeURIComponent(params.environment);
	const [projectResult, environmentResult] = await Promise.all([
		getCoolifyClient().request('GET', `/projects/${projectUuid}`),
		getCoolifyClient().request('GET', `/projects/${projectUuid}/${environmentUuid}`)
	]);
	const project = asRecord(redactSecrets(projectResult));
	const environment = asRecord(redactSecrets(environmentResult));
	if (!project || !environment) error(404, 'Environment not found');
	const projectName = firstText(project, ['name']) || params.uuid;
	const environmentName = firstText(environment, ['name']) || params.environment;
	const projectPath = `/projects/${encodeURIComponent(params.uuid)}`;
	const environmentPath = `${projectPath}/environments/${encodeURIComponent(firstText(environment, ['uuid']) || params.environment)}`;
	return {
		project,
		environment,
		projectUuid: params.uuid,
		environmentUuid: firstText(environment, ['uuid']) || params.environment,
		projectName,
		environmentName,
		breadcrumbs: [
			{ label: 'Projects', href: '/projects' },
			{ label: projectName, href: projectPath },
			{ label: environmentName, href: environmentPath }
		]
	};
};
