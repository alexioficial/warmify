import { firstText, normalizeRecords } from '../resource-presenter';
import type { CoolifyClient } from './coolify-client';

export async function loadProjectCollection(
	client: CoolifyClient
): Promise<Record<string, unknown>[]> {
	const projects = normalizeRecords(await client.request('GET', '/projects'));
	const [resourceResult, environmentResults] = await Promise.all([
		client.request('GET', '/resources').catch(() => []),
		Promise.all(
			projects.map(async (project) => {
				const uuid = firstText(project, ['uuid', 'id']);
				if (!uuid) return [];
				try {
					return normalizeRecords(
						await client.request('GET', `/projects/${encodeURIComponent(uuid)}/environments`)
					);
				} catch {
					return [];
				}
			})
		)
	]);

	const resourceCounts = new Map<string, number>();
	for (const resource of normalizeRecords(resourceResult)) {
		const environmentId = firstText(resource, ['environment_id']);
		if (!environmentId) continue;
		resourceCounts.set(environmentId, (resourceCounts.get(environmentId) ?? 0) + 1);
	}

	return projects.map((project, index) => {
		const environments = environmentResults[index];
		const resources = environments.reduce((total, environment) => {
			const environmentId = firstText(environment, ['id']);
			return total + (environmentId ? (resourceCounts.get(environmentId) ?? 0) : 0);
		}, 0);

		return {
			...project,
			environments,
			environments_count: environments.length,
			resources_count: resources
		};
	});
}
