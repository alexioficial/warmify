import { applicationHierarchy, asRecord, firstText } from '$lib/resource-presenter';
import { collectionForPage } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { getCoolifyClient } from '$lib/server/runtime';

function message(caught: unknown): string {
	return caught instanceof Error ? caught.message : 'Coolify request failed';
}

export async function loadApplication(uuid: string) {
	try {
		const [applicationResult, projects] = await Promise.all([
			getCoolifyClient().request('GET', `/applications/${encodeURIComponent(uuid)}`),
			collectionForPage('projects').catch(() => [])
		]);
		const application = asRecord(redactSecrets(applicationResult));
		if (!application) throw new Error('Application not found');
		const applicationName = firstText(application, ['name']) || uuid;
		const hierarchy = applicationHierarchy(application, projects);
		const applicationPath = `/applications/${encodeURIComponent(uuid)}/general`;
		const breadcrumbs = hierarchy
			? [
					{ label: 'Projects', href: '/projects' },
					{
						label: hierarchy.projectName,
						href: `/projects/${encodeURIComponent(hierarchy.projectUuid)}`
					},
					{
						label: hierarchy.environmentName,
						href: `/projects/${encodeURIComponent(hierarchy.projectUuid)}/environments/${encodeURIComponent(hierarchy.environmentUuid)}`
					},
					{ label: applicationName, href: applicationPath }
				]
			: [
					{ label: 'Projects', href: '/projects' },
					{ label: applicationName, href: applicationPath }
				];
		return {
			application,
			applicationName,
			uuid,
			hierarchy,
			configurationFields: resourceGroups.applications.configurationFields ?? [],
			breadcrumbs
		};
	} catch (caught) {
		return {
			application: null,
			applicationName: uuid,
			uuid,
			configurationFields: resourceGroups.applications.configurationFields ?? [],
			requestError: message(caught),
			breadcrumbs: [{ label: 'Projects', href: '/projects' }]
		};
	}
}

type RelatedPageData<Key extends string> = Partial<Record<Key, unknown>> & {
	requestError?: string;
};

export async function loadApplicationRelated<Key extends string>(
	uuid: string,
	path: string,
	key: Key
): Promise<RelatedPageData<Key>> {
	try {
		return {
			[key]: redactSecrets(
				await getCoolifyClient().request('GET', path.replace('{uuid}', encodeURIComponent(uuid)))
			)
		} as RelatedPageData<Key>;
	} catch (caught) {
		return { [key]: undefined, requestError: message(caught) } as RelatedPageData<Key>;
	}
}
