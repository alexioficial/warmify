import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import {
	applicationEnvironmentBulkSubmission,
	applicationEnvironmentVariableFailure,
	applicationEnvironmentVariableSubmission,
	findEnvironmentVariable,
	redactApplicationEnvironmentVariables
} from '$lib/server/application-environment-variables';
import type { CoolifyMethod, CoolifyRequestOptions } from '$lib/server/coolify-client';
import { CoolifyError } from '$lib/server/coolify-client';
import { requestCapability } from '$lib/server/capabilities';
import { invalidateCollection } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import {
	applicationDomainFailure,
	applicationDomainSubmission,
	configurationFailure,
	configurationSubmission,
	resourceActionRequest
} from '$lib/server/resource-actions';
import { resourceGroups } from '$lib/server/resource-groups';
import { audit, getCoolifyClient } from '$lib/server/runtime';
import { serviceVariableBody } from './service-operation-presenter';

import { collectionPath } from '$lib/resource-routes';
import type { RequestEvent } from '@sveltejs/kit';

interface RelatedRequest {
	key: string;
	path: (uuid: string) => string;
}

const RELATED_REQUESTS: Record<string, RelatedRequest[]> = {
	projects: [
		{ key: 'environments', path: (uuid) => `/projects/${uuid}/environments` },
		{ key: 'variables', path: (uuid) => `/projects/${uuid}/envs` }
	],
	applications: [
		{ key: 'deployments', path: (uuid) => `/deployments/applications/${uuid}` },
		{ key: 'variables', path: (uuid) => `/applications/${uuid}/envs` },
		{ key: 'storages', path: (uuid) => `/applications/${uuid}/storages` },
		{ key: 'tasks', path: (uuid) => `/applications/${uuid}/scheduled-tasks` },
		{ key: 'logs', path: (uuid) => `/applications/${uuid}/logs` }
	],
	services: [
		{ key: 'applications', path: (uuid) => `/services/${uuid}/applications` },
		{ key: 'databases', path: (uuid) => `/services/${uuid}/databases` },
		{ key: 'variables', path: (uuid) => `/services/${uuid}/envs` },
		{ key: 'storages', path: (uuid) => `/services/${uuid}/storages` },
		{ key: 'tasks', path: (uuid) => `/services/${uuid}/scheduled-tasks` },
		{ key: 'logs', path: (uuid) => `/services/${uuid}/logs` }
	],
	databases: [
		{ key: 'backups', path: (uuid) => `/databases/${uuid}/backups` },
		{ key: 'variables', path: (uuid) => `/databases/${uuid}/envs` },
		{ key: 'storages', path: (uuid) => `/databases/${uuid}/storages` },
		{ key: 'logs', path: (uuid) => `/databases/${uuid}/logs` }
	],
	servers: [
		{ key: 'resources', path: (uuid) => `/servers/${uuid}/resources` },
		{ key: 'domains', path: (uuid) => `/servers/${uuid}/domains` },
		{ key: 'variables', path: (uuid) => `/servers/${uuid}/envs` },
		{ key: 'cleanup', path: (uuid) => `/servers/${uuid}/docker-cleanup` }
	]
};

function getGroup(groupName: string) {
	const group = resourceGroups[groupName];
	if (!group?.detailPath) error(404, 'Resource detail is not available');
	return group;
}

function detailPath(groupName: string, uuid: string): string {
	return getGroup(groupName).detailPath!.replace('{uuid}', encodeURIComponent(uuid));
}

interface OptionalResult {
	value: unknown;
	status: 'available' | 'unavailable' | 'error';
}

async function optionalGet(capability: string, path: string): Promise<OptionalResult> {
	try {
		const result = await requestCapability(capability, () =>
			getCoolifyClient().request('GET', path)
		);
		if (!result.available) return { value: undefined, status: 'unavailable' };
		return {
			value: path.endsWith('/envs')
				? redactApplicationEnvironmentVariables(result.value)
				: redactSecrets(result.value),
			status: 'available'
		};
	} catch {
		return { value: undefined, status: 'error' };
	}
}

function failureStatus(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

function failureMessage(caught: unknown): string {
	return caught instanceof Error ? caught.message : 'Coolify request failed';
}

async function mutate(
	request: { method: CoolifyMethod; path: string; options?: CoolifyRequestOptions },
	operation: string,
	username?: string
) {
	const started = Date.now();
	try {
		await getCoolifyClient().request(request.method, request.path, request.options);
		audit({
			user: username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { success: true as const };
	} catch (caught) {
		audit({
			user: username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return { success: false as const, caught };
	}
}

export async function loadResourceDetail(
	groupName: string,
	uuid: string,
	setHeaders: (headers: Record<string, string>) => void
) {
	const group = getGroup(groupName);
	setHeaders({ 'cache-control': 'no-store' });
	const encodedUuid = encodeURIComponent(uuid);
	try {
		const data = redactSecrets(
			await getCoolifyClient().request('GET', detailPath(groupName, uuid))
		);
		const relatedResults = await Promise.all(
			(RELATED_REQUESTS[groupName] ?? []).map(async (request) => ({
				key: request.key,
				result: await optionalGet(`${groupName}-${request.key}`, request.path(encodedUuid))
			}))
		);
		return {
			title: group.title,
			group: groupName,
			uuid,
			configurationFields: group.configurationFields ?? [],
			data,
			related: Object.fromEntries(relatedResults.map(({ key, result }) => [key, result.value])),
			relatedCapabilities: Object.fromEntries(
				relatedResults
					.filter(({ result }) => result.status !== 'available')
					.map(({ key, result }) => [key, result.status])
			)
		};
	} catch (caught) {
		return {
			title: group.title,
			group: groupName,
			uuid,
			configurationFields: group.configurationFields ?? [],
			data: null,
			related: {},
			relatedCapabilities: {},
			requestError: failureMessage(caught)
		};
	}
}

function eventUuid(event: RequestEvent): string {
	const uuid = event.params.uuid;
	if (!uuid) error(400, 'Resource identifier is required');
	return uuid;
}

export function createResourceActions(groupName: string) {
	return {
		lifecycle: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			const form = await request.formData();
			const action = String(form.get('action') ?? '');
			if (['stop', 'restart'].includes(action) && form.get('confirmation') !== 'confirm') {
				return fail(400, { error: `Confirm ${action} before continuing` });
			}
			try {
				const result = await mutate(
					resourceActionRequest(groupName, uuid, action),
					`${action}-${groupName}`,
					locals.user?.username
				);
				if (!result.success)
					return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
				invalidateCollection(groupName);
				invalidateCollection('resources');
				invalidateCollection('deployments');
				return { message: `${action.charAt(0).toUpperCase()}${action.slice(1)} requested` };
			} catch (caught) {
				return fail(failureStatus(caught), { error: failureMessage(caught) });
			}
		},

		save: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			const group = getGroup(groupName);
			const form = await request.formData();
			const section = String(form.get('_section') ?? 'configuration');
			const fields = ['applications', 'services'].includes(groupName)
				? (group.configurationFields ?? []).filter((field) => field.section === section)
				: (group.configurationFields ?? []);
			if (fields.length === 0)
				return fail(400, { error: 'Unknown configuration section', section, values: {} });
			const submission = configurationSubmission(form, fields);
			if (Object.keys(submission.fieldErrors).length > 0) {
				return fail(400, {
					error: 'Correct the highlighted fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					section
				});
			}
			if (Object.keys(submission.body).length === 0)
				return fail(400, {
					error: 'No editable fields found',
					values: submission.values,
					section
				});
			const result = await mutate(
				{
					method: 'PATCH',
					path: detailPath(groupName, uuid),
					options: { body: submission.body }
				},
				`update-${groupName}`,
				locals.user?.username
			);
			if (!result.success) {
				const failure = configurationFailure(result.caught, fields, submission.sensitiveValues);
				return fail(failureStatus(result.caught), {
					...failure,
					values: submission.values,
					section
				});
			}
			invalidateCollection(groupName);
			invalidateCollection('resources');
			return {
				message: 'Configuration saved',
				values: submission.values,
				section
			};
		},

		saveDomains: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			if (groupName !== 'applications') return fail(404, { error: 'Action is not available' });
			const submission = applicationDomainSubmission(await request.formData());
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted domains.',
					domainRows: submission.rows,
					redirect: submission.redirect,
					forceHttps: submission.forceHttps,
					rowErrors: submission.rowErrors,
					section: 'domains'
				});
			}
			const result = await mutate(
				{
					method: 'PATCH',
					path: detailPath(groupName, uuid),
					options: { body: submission.body }
				},
				'update-application-domains',
				locals.user?.username
			);
			if (!result.success) {
				return fail(failureStatus(result.caught), {
					...applicationDomainFailure(result.caught),
					domainRows: submission.rows,
					redirect: submission.redirect,
					forceHttps: submission.forceHttps,
					rowErrors: submission.rowErrors,
					section: 'domains'
				});
			}
			invalidateCollection('applications');
			invalidateCollection('resources');
			return {
				message: 'Domains saved',
				domainRows: submission.rows,
				redirect: submission.redirect,
				forceHttps: submission.forceHttps,
				section: 'domains'
			};
		},

		createEnvironment: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			if (groupName !== 'projects') return fail(404, { error: 'Action is not available' });
			const form = await request.formData();
			const name = String(form.get('name') ?? '').trim();
			if (!name) return fail(400, { error: 'Environment name is required' });
			const result = await mutate(
				{
					method: 'POST',
					path: `/projects/${encodeURIComponent(uuid)}/environments`,
					options: {
						body: {
							name,
							description: String(form.get('description') ?? '').trim() || undefined
						}
					}
				},
				'create-environment',
				locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
			invalidateCollection('projects');
			return { message: `Environment ${name} created` };
		},

		createVariable: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			const allowedGroups = new Set([
				'projects',
				'applications',
				'services',
				'databases',
				'servers'
			]);
			if (!allowedGroups.has(groupName)) return fail(404, { error: 'Action is not available' });
			const form = await request.formData();
			const submission = applicationEnvironmentVariableSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target: 'create'
				});
			}
			const body = ['services', 'databases'].includes(groupName)
				? serviceVariableBody(submission.body)
				: ['applications', 'databases'].includes(groupName)
					? submission.body
					: {
							key: submission.body.key,
							value: submission.body.value,
							is_preview: submission.body.is_preview,
							is_literal: submission.body.is_literal,
							is_multiline: submission.body.is_multiline,
							is_shown_once: submission.body.is_shown_once
						};
			const result = await mutate(
				{
					method: 'POST',
					path: `/${groupName}/${encodeURIComponent(uuid)}/envs`,
					options: { body }
				},
				`create-${groupName}-variable`,
				locals.user?.username
			);
			if (!result.success) {
				const failure = applicationEnvironmentVariableFailure(
					result.caught,
					submission.sensitiveValues
				);
				return fail(failureStatus(result.caught), {
					...failure,
					values: submission.values,
					target: 'create'
				});
			}
			invalidateCollection(groupName);
			invalidateCollection('resources');
			invalidateCollection('projects');
			return { message: `Variable ${submission.body.key} created`, target: 'create' };
		},

		updateVariable: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			if (!['applications', 'services', 'databases'].includes(groupName))
				return fail(404, { error: 'Action is not available' });
			const form = await request.formData();
			const target = String(form.get('env_uuid') ?? '');
			if (!target)
				return fail(400, {
					error: 'Variable identifier is required.',
					target,
					operation: 'update' as const
				});
			const submission = applicationEnvironmentVariableSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target,
					operation: 'update' as const
				});
			}
			if (groupName === 'databases') {
				try {
					const variables = redactApplicationEnvironmentVariables(
						await getCoolifyClient().request('GET', `/databases/${encodeURIComponent(uuid)}/envs`)
					);
					const variable = findEnvironmentVariable(variables, target);
					if (!variable)
						return fail(404, {
							error: 'Variable not found in this database.',
							target,
							operation: 'update' as const
						});
					if (firstText(variable, ['key']) !== submission.body.key)
						return fail(400, {
							error: 'The variable key changed. Reload before editing it.',
							target,
							operation: 'update' as const
						});
				} catch (caught) {
					return fail(failureStatus(caught), {
						...applicationEnvironmentVariableFailure(caught, submission.sensitiveValues),
						target,
						operation: 'update' as const
					});
				}
			}
			const result = await mutate(
				{
					method: 'PATCH',
					path: `/${groupName}/${encodeURIComponent(uuid)}/envs`,
					options: {
						body: ['services', 'databases'].includes(groupName)
							? serviceVariableBody(submission.body)
							: submission.body
					}
				},
				`update-${groupName.slice(0, -1)}-variable`,
				locals.user?.username
			);
			if (!result.success) {
				const failure = applicationEnvironmentVariableFailure(
					result.caught,
					submission.sensitiveValues
				);
				return fail(failureStatus(result.caught), {
					...failure,
					values: submission.values,
					target,
					operation: 'update' as const
				});
			}
			invalidateCollection(groupName);
			invalidateCollection('resources');
			invalidateCollection('projects');
			return {
				message: `Variable ${submission.body.key} updated`,
				target,
				operation: 'update' as const
			};
		},

		deleteVariable: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			if (!['applications', 'services', 'databases'].includes(groupName))
				return fail(404, { error: 'Action is not available' });
			const form = await request.formData();
			const envUuid = String(form.get('env_uuid') ?? '');
			const confirmation = String(form.get('confirmation') ?? '');
			if (!envUuid)
				return fail(400, {
					error: 'Variable identifier is required.',
					target: envUuid,
					operation: 'delete' as const
				});
			try {
				const variables = redactApplicationEnvironmentVariables(
					await getCoolifyClient().request('GET', `/${groupName}/${encodeURIComponent(uuid)}/envs`)
				);
				const variable = findEnvironmentVariable(variables, envUuid);
				if (!variable)
					return fail(404, {
						error: 'Variable not found.',
						target: envUuid,
						operation: 'delete' as const
					});
				const key = firstText(variable, ['key']);
				if (confirmation !== key && confirmation !== envUuid) {
					return fail(400, {
						error: `Type ${key || envUuid} exactly to delete this variable.`,
						target: envUuid,
						operation: 'delete' as const
					});
				}
				const result = await mutate(
					{
						method: 'DELETE',
						path: `/${groupName}/${encodeURIComponent(uuid)}/envs/${encodeURIComponent(envUuid)}`
					},
					`delete-${groupName.slice(0, -1)}-variable`,
					locals.user?.username
				);
				if (!result.success) {
					return fail(failureStatus(result.caught), {
						...applicationEnvironmentVariableFailure(result.caught, []),
						target: envUuid,
						operation: 'delete' as const
					});
				}
				invalidateCollection(groupName);
				invalidateCollection('resources');
				invalidateCollection('projects');
				return {
					message: `Variable ${key || envUuid} deleted`,
					target: envUuid,
					operation: 'delete' as const
				};
			} catch (caught) {
				return fail(failureStatus(caught), {
					...applicationEnvironmentVariableFailure(caught, []),
					target: envUuid,
					operation: 'delete' as const
				});
			}
		},

		bulkVariables: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			if (!['applications', 'services', 'databases'].includes(groupName))
				return fail(404, { error: 'Action is not available' });
			const form = await request.formData();
			if (groupName === 'databases' && String(form.get('preview') ?? '').trim())
				return fail(400, {
					error: 'Database variables have no preview scope. Use the production input only.',
					target: 'bulk'
				});
			const submission = applicationEnvironmentBulkSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the bulk variable input.',
					fieldErrors: submission.fieldErrors,
					target: 'bulk'
				});
			}
			const result = await mutate(
				{
					method: 'PATCH',
					path: `/${groupName}/${encodeURIComponent(uuid)}/envs/bulk`,
					options: {
						body: ['services', 'databases'].includes(groupName)
							? { data: submission.body.data.map(serviceVariableBody) }
							: submission.body
					}
				},
				`bulk-upsert-${groupName.slice(0, -1)}-variables`,
				locals.user?.username
			);
			if (!result.success) {
				return fail(failureStatus(result.caught), {
					...applicationEnvironmentVariableFailure(result.caught, submission.sensitiveValues),
					target: 'bulk'
				});
			}
			invalidateCollection(groupName);
			invalidateCollection('resources');
			invalidateCollection('projects');
			return {
				message: `${submission.count} variable${submission.count === 1 ? '' : 's'} upserted`,
				target: 'bulk'
			};
		},

		deleteResource: async (event: RequestEvent) => {
			const { request, locals } = event;
			const uuid = eventUuid(event);
			const form = await request.formData();
			const confirmation = String(form.get('confirmation') ?? '');
			try {
				const current = await getCoolifyClient().request('GET', detailPath(groupName, uuid));
				const name = firstText(asRecord(current), ['name']);
				if (confirmation !== uuid && confirmation !== name) {
					return fail(400, { error: `Type ${name || uuid} exactly to delete this resource` });
				}
				const result = await mutate(
					{ method: 'DELETE', path: detailPath(groupName, uuid) },
					`delete-${groupName}`,
					locals.user?.username
				);
				if (!result.success)
					return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
				invalidateCollection(groupName);
				invalidateCollection('resources');
				invalidateCollection('projects');
			} catch (caught) {
				return fail(failureStatus(caught), { error: failureMessage(caught) });
			}
			redirect(303, collectionPath(groupName) ?? '/');
		}
	};
}
