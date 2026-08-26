import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import type { CoolifyMethod, CoolifyRequestOptions } from '$lib/server/coolify-client';
import { CoolifyError } from '$lib/server/coolify-client';
import { redactSecrets } from '$lib/server/redact';
import { configurationBody, resourceActionRequest } from '$lib/server/resource-actions';
import { resourceGroups } from '$lib/server/resource-groups';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const group = getGroup(params.group);
	setHeaders({ 'cache-control': 'no-store' });
	const encodedUuid = encodeURIComponent(params.uuid);
	try {
		const data = redactSecrets(
			await getCoolifyClient().request('GET', detailPath(params.group, params.uuid))
		);
		const relatedEntries = await Promise.all(
			(RELATED_REQUESTS[params.group] ?? []).map(async (request) => [
				request.key,
				await optionalGet(request.path(encodedUuid))
			])
		);
		return {
			title: group.title,
			group: params.group,
			uuid: params.uuid,
			configurationFields: group.configurationFields ?? [],
			data,
			related: Object.fromEntries(relatedEntries)
		};
	} catch (caught) {
		return {
			title: group.title,
			group: params.group,
			uuid: params.uuid,
			configurationFields: group.configurationFields ?? [],
			data: null,
			related: {},
			requestError: failureMessage(caught)
		};
	}
};

export const actions: Actions = {
	lifecycle: async ({ params, request, locals }) => {
		const form = await request.formData();
		const action = String(form.get('action') ?? '');
		if (['stop', 'restart'].includes(action) && form.get('confirmation') !== 'confirm') {
			return fail(400, { error: `Confirm ${action} before continuing` });
		}
		try {
			const result = await mutate(
				resourceActionRequest(params.group, params.uuid, action),
				`${action}-${params.group}`,
				locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
			return { message: `${action.charAt(0).toUpperCase()}${action.slice(1)} requested` };
		} catch (caught) {
			return fail(failureStatus(caught), { error: failureMessage(caught) });
		}
	},

	save: async ({ params, request, locals }) => {
		const group = getGroup(params.group);
		const form = await request.formData();
		const body = configurationBody(
			form,
			(group.configurationFields ?? []).map((field) => field.name)
		);
		if (Object.keys(body).length === 0) return fail(400, { error: 'No editable fields found' });
		const result = await mutate(
			{ method: 'PATCH', path: detailPath(params.group, params.uuid), options: { body } },
			`update-${params.group}`,
			locals.user?.username
		);
		if (!result.success)
			return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
		return { message: 'Configuration saved' };
	},

	createEnvironment: async ({ params, request, locals }) => {
		if (params.group !== 'projects') return fail(404, { error: 'Action is not available' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Environment name is required' });
		const result = await mutate(
			{
				method: 'POST',
				path: `/projects/${encodeURIComponent(params.uuid)}/environments`,
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
		return { message: `Environment ${name} created` };
	},

	createVariable: async ({ params, request, locals }) => {
		const allowedGroups = new Set(['projects', 'applications', 'services', 'databases', 'servers']);
		if (!allowedGroups.has(params.group)) return fail(404, { error: 'Action is not available' });
		const form = await request.formData();
		const key = String(form.get('key') ?? '').trim();
		const value = String(form.get('value') ?? '');
		if (!key) return fail(400, { error: 'Variable key is required' });
		const result = await mutate(
			{
				method: 'POST',
				path: `/${params.group}/${encodeURIComponent(params.uuid)}/envs`,
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
			`create-${params.group}-variable`,
			locals.user?.username
		);
		if (!result.success)
			return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
		return { message: `Variable ${key} created` };
	},

	deleteResource: async ({ params, request, locals }) => {
		const form = await request.formData();
		const confirmation = String(form.get('confirmation') ?? '');
		try {
			const current = await getCoolifyClient().request(
				'GET',
				detailPath(params.group, params.uuid)
			);
			const name = firstText(asRecord(current), ['name']);
			if (confirmation !== params.uuid && confirmation !== name) {
				return fail(400, { error: `Type ${name || params.uuid} exactly to delete this resource` });
			}
			const result = await mutate(
				{ method: 'DELETE', path: detailPath(params.group, params.uuid) },
				`delete-${params.group}`,
				locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), { error: failureMessage(result.caught) });
		} catch (caught) {
			return fail(failureStatus(caught), { error: failureMessage(caught) });
		}
		redirect(303, `/manage/${params.group}`);
	}
};
