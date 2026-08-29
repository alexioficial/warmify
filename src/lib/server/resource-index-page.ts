import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from '$lib/server/coolify-client';
import { collectionForPage, invalidateCollection } from '$lib/server/inventory-cache';
import { executeOperation } from '$lib/server/operations';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import { detailPath as routeDetailPath } from '$lib/resource-routes';
import type { RequestEvent } from '@sveltejs/kit';

export async function loadResourceIndex(
	groupName: string,
	setHeaders: (headers: Record<string, string>) => void
) {
	const group = resourceGroups[groupName];
	if (!group) error(404, 'Resource group not found');
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return {
			group: groupName,
			...group,
			data: redactSecrets(await collectionForPage(groupName))
		};
	} catch (caught) {
		return {
			group: groupName,
			...group,
			data: [],
			requestError: caught instanceof Error ? caught.message : 'Coolify request failed'
		};
	}
}

export function createIndexActions(groupName: string) {
	return {
		createProject: async ({ request, locals }: RequestEvent) => {
			if (groupName !== 'projects') return fail(404, { error: 'Action not available', name: '' });
			const form = await request.formData();
			const name = String(form.get('name') ?? '').trim();
			if (!name) return fail(400, { error: 'Name is required', name });
			const started = Date.now();
			let createdUuid: string;
			try {
				const result = await getCoolifyClient().request('POST', '/projects', {
					body: { name, description: String(form.get('description') ?? '').trim() || undefined }
				});
				audit({
					user: locals.user?.username,
					operation: 'create-project',
					result: 'success',
					duration_ms: Date.now() - started
				});
				createdUuid = firstText(asRecord(result), ['uuid', 'id']);
				invalidateCollection('projects');
				if (!createdUuid) return { message: 'Project created', name: '' };
			} catch (caught) {
				const status =
					caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
						? caught.status
						: 500;
				audit({
					user: locals.user?.username,
					operation: 'create-project',
					result: 'error',
					duration_ms: Date.now() - started
				});
				return fail(status, {
					error: caught instanceof Error ? caught.message : 'Coolify request failed',
					name
				});
			}
			redirect(303, routeDetailPath('projects', createdUuid) ?? '/projects');
		},
		systemAction: async ({ request, locals }: RequestEvent) => {
			if (groupName !== 'system') return fail(404, { error: 'Action not available' });
			const form = await request.formData();
			const action = String(form.get('action') ?? '');
			const operations: Record<string, string> = {
				enable: 'POST:/enable',
				disable: 'POST:/disable',
				'mcp-enable': 'POST:/mcp/enable',
				'mcp-disable': 'POST:/mcp/disable'
			};
			const operationId = operations[action];
			if (!operationId) return fail(400, { error: 'Unknown system action' });
			if (action === 'disable' && form.get('confirmation') !== 'confirm') {
				return fail(400, { error: 'Confirm that Warmify will lose API access' });
			}
			const started = Date.now();
			try {
				await executeOperation(getCoolifyClient(), {
					operationId,
					parameters: {},
					query: {},
					body: undefined,
					confirmation: ['disable', 'mcp-disable'].includes(action) ? 'confirm' : undefined
				});
				audit({
					user: locals.user?.username,
					operation: action,
					result: 'success',
					duration_ms: Date.now() - started
				});
				invalidateCollection('system');
				return { message: `${action.replace('-', ' ')} requested` };
			} catch (caught) {
				const status = caught instanceof CoolifyError ? caught.status : 500;
				return fail(status, {
					error: caught instanceof Error ? caught.message : 'Coolify request failed'
				});
			}
		}
	};
}
