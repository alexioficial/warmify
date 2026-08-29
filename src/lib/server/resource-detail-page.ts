import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import type { CoolifyMethod, CoolifyRequestOptions } from '$lib/server/coolify-client';
import { CoolifyError } from '$lib/server/coolify-client';
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

async function optionalGet(path: string): Promise<unknown> {
	try {
		return redactSecrets(await getCoolifyClient().request('GET', path));
	} catch {
		return undefined;
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
		const relatedEntries = await Promise.all(
			(RELATED_REQUESTS[groupName] ?? []).map(async (request) => [
				request.key,
				await optionalGet(request.path(encodedUuid))
			])
		);
		return {
			title: group.title,
			group: groupName,
			uuid,
			configurationFields: group.configurationFields ?? [],
			data,
			related: Object.fromEntries(relatedEntries)
		};
	} catch (caught) {
		return {
			title: group.title,
			group: groupName,
			uuid,
			configurationFields: group.configurationFields ?? [],
			data: null,
			related: {},
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
			const fields =
				groupName === 'applications'
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
			const key = String(form.get('key') ?? '').trim();
			const value = String(form.get('value') ?? '');
			if (!key) return fail(400, { error: 'Variable key is required' });
			const result = await mutate(
				{
					method: 'POST',
					path: `/${groupName}/${encodeURIComponent(uuid)}/envs`,
					options: {
						body: {
							key,
							value,
							is_build_time: form.has('is_build_time'),
							is_preview: form.has('is_preview'),
							is_literal: form.has('is_literal'),
							is_multiline: form.has('is_multiline')
						}
					}
				},
				`create-${groupName}-variable`,
				locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
			return { message: `Variable ${key} created` };
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
