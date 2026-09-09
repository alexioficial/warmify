import { applicationHierarchy, asRecord, firstText } from '$lib/resource-presenter';
import { redactApplicationEnvironmentVariables } from '$lib/server/application-environment-variables';
import {
	normalizeApplicationStorages,
	normalizeS3StorageOptions
} from '$lib/server/application-storage-actions';
import { CoolifyError, type CoolifyRequestOptions } from '$lib/server/coolify-client';
import { collectionForPage } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { getCoolifyClient } from '$lib/server/runtime';
import {
	normalizeScheduledTaskExecutions,
	normalizeScheduledTasks
} from '$lib/server/scheduled-task-actions';

function message(caught: unknown): string {
	return caught instanceof Error ? caught.message : 'Coolify request failed';
}

export interface ApplicationRequestFailure {
	message: string;
	status: number;
	retryAfterSeconds?: number;
	retryable: boolean;
}

function requestFailure(caught: unknown): ApplicationRequestFailure {
	const status = caught instanceof CoolifyError ? caught.status : 500;
	return {
		message: message(caught),
		status,
		...(caught instanceof CoolifyError && caught.retryAfterSeconds
			? { retryAfterSeconds: caught.retryAfterSeconds }
			: {}),
		retryable: status === 429 || status >= 500
	};
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
	requestFailure?: ApplicationRequestFailure;
};

export async function loadApplicationRelated<Key extends string>(
	uuid: string,
	path: string,
	key: Key,
	options: CoolifyRequestOptions = {}
): Promise<RelatedPageData<Key>> {
	try {
		return {
			[key]: redactSecrets(
				await getCoolifyClient().request(
					'GET',
					path.replace('{uuid}', encodeURIComponent(uuid)),
					options
				)
			)
		} as RelatedPageData<Key>;
	} catch (caught) {
		return {
			[key]: undefined,
			requestError: message(caught),
			requestFailure: requestFailure(caught)
		} as RelatedPageData<Key>;
	}
}

export async function loadApplicationEnvironmentVariables(uuid: string) {
	try {
		const variables = await getCoolifyClient().request(
			'GET',
			`/applications/${encodeURIComponent(uuid)}/envs`
		);
		return { variables: redactApplicationEnvironmentVariables(variables) };
	} catch (caught) {
		return { variables: undefined, requestError: message(caught) };
	}
}

export async function loadApplicationStorages(uuid: string) {
	const encodedUuid = encodeURIComponent(uuid);
	const [storageResult, s3Result] = await Promise.allSettled([
		getCoolifyClient().request('GET', `/applications/${encodedUuid}/storages`),
		getCoolifyClient().request('GET', '/s3-storages')
	]);
	return {
		storages:
			storageResult.status === 'fulfilled' ? normalizeApplicationStorages(storageResult.value) : [],
		s3Storages: s3Result.status === 'fulfilled' ? normalizeS3StorageOptions(s3Result.value) : [],
		...(storageResult.status === 'rejected' ? { requestError: message(storageResult.reason) } : {}),
		...(s3Result.status === 'rejected' ? { s3RequestError: message(s3Result.reason) } : {})
	};
}

export async function loadApplicationScheduledTasks(uuid: string) {
	const encodedUuid = encodeURIComponent(uuid);
	try {
		const tasks = normalizeScheduledTasks(
			redactSecrets(
				await getCoolifyClient().request('GET', `/applications/${encodedUuid}/scheduled-tasks`)
			)
		);
		return {
			tasks: await Promise.all(
				tasks.map(async (task) => {
					try {
						const executions = await getCoolifyClient().request(
							'GET',
							`/applications/${encodedUuid}/scheduled-tasks/${encodeURIComponent(task.id)}/executions`
						);
						return {
							...task,
							executions: normalizeScheduledTaskExecutions(redactSecrets(executions))
						};
					} catch (caught) {
						return { ...task, executionError: message(caught) };
					}
				})
			)
		};
	} catch (caught) {
		return { tasks: [], requestError: message(caught), requestFailure: requestFailure(caught) };
	}
}
