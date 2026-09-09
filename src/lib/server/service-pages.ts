import { applicationHierarchy, asRecord, firstText, normalizeRecords } from '../resource-presenter';

import { redactApplicationEnvironmentVariables } from './application-environment-variables';
import {
	normalizeApplicationStorages,
	normalizeS3StorageOptions
} from './application-storage-actions';
import { CoolifyError } from './coolify-client';
import { collectionForPage } from './inventory-cache';
import { redactSecrets } from './redact';
import { resourceGroups } from './resource-groups';
import { getCoolifyClient } from './runtime';
import { serviceOverview } from './service-operation-presenter';
import {
	normalizeScheduledTaskExecutions,
	normalizeScheduledTasks
} from './scheduled-task-actions';

function message(caught: unknown): string {
	return caught instanceof Error ? caught.message : 'Coolify request failed';
}

function redactService(value: unknown): Record<string, unknown> | undefined {
	const record = asRecord(redactSecrets(value));
	if (!record) return undefined;
	const service = { ...record };
	delete service.docker_compose_raw;
	delete service.docker_compose;
	return service;
}

export async function loadService(uuid: string) {
	try {
		const [serviceResult, projects] = await Promise.all([
			getCoolifyClient().request('GET', `/services/${encodeURIComponent(uuid)}`),
			collectionForPage('projects').catch(() => [])
		]);
		const service = redactService(serviceResult);
		if (!service) throw new Error('Service not found');
		const serviceName = firstText(service, ['name']) || uuid;
		const hierarchy = applicationHierarchy(service, projects);
		const servicePath = `/services/${encodeURIComponent(uuid)}/general`;
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
					{ label: serviceName, href: servicePath }
				]
			: [
					{ label: 'Projects', href: '/projects' },
					{ label: serviceName, href: servicePath }
				];
		return {
			service,
			overview: serviceOverview(service),
			serviceName,
			uuid,
			hierarchy,
			configurationFields: resourceGroups.services.configurationFields ?? [],
			breadcrumbs
		};
	} catch (caught) {
		return {
			service: null,
			serviceName: uuid,
			uuid,
			configurationFields: resourceGroups.services.configurationFields ?? [],
			requestError: message(caught),
			breadcrumbs: [{ label: 'Projects', href: '/projects' }]
		};
	}
}

export async function loadServiceEnvironmentVariables(uuid: string) {
	try {
		const variables = await getCoolifyClient().request(
			'GET',
			`/services/${encodeURIComponent(uuid)}/envs`
		);
		return { variables: redactApplicationEnvironmentVariables(variables) };
	} catch (caught) {
		return { variables: undefined, requestError: message(caught) };
	}
}

export async function loadServiceStorages(uuid: string) {
	const encodedUuid = encodeURIComponent(uuid);
	const [storageResult, s3Result] = await Promise.allSettled([
		getCoolifyClient().request('GET', `/services/${encodedUuid}/storages`),
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

export async function loadServiceScheduledTasks(uuid: string) {
	const encodedUuid = encodeURIComponent(uuid);
	try {
		const tasks = normalizeScheduledTasks(
			redactSecrets(
				await getCoolifyClient().request('GET', `/services/${encodedUuid}/scheduled-tasks`)
			)
		);
		return {
			tasks: await Promise.all(
				tasks.map(async (task) => {
					try {
						const executions = await getCoolifyClient().request(
							'GET',
							`/services/${encodedUuid}/scheduled-tasks/${encodeURIComponent(task.id)}/executions`
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
		return { tasks: [], requestError: message(caught) };
	}
}

export function serviceLogTargets(service: unknown) {
	const record = asRecord(service);
	return [
		...normalizeRecords(record?.applications).map((resource) => ({
			name: firstText(resource, ['name']),
			label: firstText(resource, ['human_name', 'name']) || 'Application',
			type: 'Application'
		})),
		...normalizeRecords(record?.databases).map((resource) => ({
			name: firstText(resource, ['name']),
			label: firstText(resource, ['human_name', 'name']) || 'Database',
			type: 'Database'
		}))
	].filter((target) => Boolean(target.name));
}

export async function loadServiceLogs(uuid: string, requestedTarget = '') {
	let targets: ReturnType<typeof serviceLogTargets> = [];
	let selectedTarget = requestedTarget;
	try {
		const service = redactService(
			await getCoolifyClient().request('GET', `/services/${encodeURIComponent(uuid)}`)
		);
		if (!service) throw new Error('Service not found');
		targets = serviceLogTargets(service);
		selectedTarget = targets.some((target) => target.name === requestedTarget)
			? requestedTarget
			: (targets[0]?.name ?? '');
		if (!selectedTarget) return { targets, selectedTarget, logs: undefined };
		const logs = await getCoolifyClient().request(
			'GET',
			`/services/${encodeURIComponent(uuid)}/logs`,
			{ query: { sub_service_name: selectedTarget, lines: 100, show_timestamps: false } }
		);
		return { targets, selectedTarget, logs: redactSecrets(logs) };
	} catch (caught) {
		const status = caught instanceof CoolifyError ? caught.status : 500;
		return {
			targets,
			selectedTarget,
			logs: undefined,
			requestError: message(caught),
			requestFailure: {
				message: [404, 405, 501].includes(status)
					? 'Logs are unavailable for this resource on this Coolify installation.'
					: message(caught),
				status,
				...(caught instanceof CoolifyError && caught.retryAfterSeconds
					? { retryAfterSeconds: caught.retryAfterSeconds }
					: {}),
				retryable: status === 429 || status >= 500
			}
		};
	}
}
