import { asRecord, firstText } from '$lib/resource-presenter';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { getCoolifyClient } from '$lib/server/runtime';

function message(caught: unknown): string {
	return caught instanceof Error ? caught.message : 'Coolify request failed';
}

export async function loadApplication(uuid: string) {
	try {
		const application = asRecord(
			redactSecrets(
				await getCoolifyClient().request('GET', `/applications/${encodeURIComponent(uuid)}`)
			)
		);
		if (!application) throw new Error('Application not found');
		const applicationName = firstText(application, ['name']) || uuid;
		return {
			application,
			applicationName,
			uuid,
			configurationFields: resourceGroups.applications.configurationFields ?? [],
			breadcrumbs: [
				{ label: 'Applications', href: '/applications' },
				{ label: applicationName, href: `/applications/${encodeURIComponent(uuid)}/general` }
			]
		};
	} catch (caught) {
		return {
			application: null,
			applicationName: uuid,
			uuid,
			configurationFields: resourceGroups.applications.configurationFields ?? [],
			requestError: message(caught),
			breadcrumbs: [
				{ label: 'Applications', href: '/applications' },
				{ label: uuid, href: `/applications/${encodeURIComponent(uuid)}/general` }
			]
		};
	}
}

export async function loadApplicationRelated(uuid: string, path: string, key: string) {
	try {
		return {
			[key]: redactSecrets(
				await getCoolifyClient().request(
					'GET',
					path.replace('{uuid}', encodeURIComponent(uuid))
				)
			)
		};
	} catch (caught) {
		return { [key]: undefined, requestError: message(caught) };
	}
}
