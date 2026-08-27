import { error } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import { collectionForPage } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import { createResourceActions } from '$lib/server/resource-detail-page';
import { getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const projectUuid = encodeURIComponent(params.uuid);
	const [projectResult, environmentResult, resourceResult] = await Promise.all([
		getCoolifyClient().request('GET', `/projects/${projectUuid}`),
		getCoolifyClient().request('GET', `/projects/${projectUuid}/environments`),
		collectionForPage('resources').catch(() => [])
	]);
	const project = asRecord(redactSecrets(projectResult));
	if (!project) error(404, 'Project not found');

	const counts = new Map<string, number>();
	for (const resource of normalizeRecords(resourceResult)) {
		const environmentId = firstText(resource, ['environment_id']);
		if (environmentId) counts.set(environmentId, (counts.get(environmentId) ?? 0) + 1);
	}
	const environments = normalizeRecords(redactSecrets(environmentResult)).map((environment) => {
		const id = firstText(environment, ['id']);
		return { ...environment, resources_count: id ? (counts.get(id) ?? 0) : 0 };
	});
	const projectName = firstText(project, ['name']) || params.uuid;

	return {
		project,
		projectUuid: params.uuid,
		projectName,
		environments,
		breadcrumbs: [
			{ label: 'Projects', href: '/projects' },
			{ label: projectName, href: `/projects/${encodeURIComponent(params.uuid)}` }
		]
	};
};
export const actions: Actions = createResourceActions('projects');
