import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from '$lib/server/coolify-client';
import { executeOperation } from '$lib/server/operations';
import { redactSecrets } from '$lib/server/redact';
import { resourceGroups } from '$lib/server/resource-groups';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const group = resourceGroups[params.group];
	if (!group) error(404, 'Resource group not found');
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return {
			group: params.group,
			...group,
			data: redactSecrets(await getCoolifyClient().request('GET', group.listPath))
		};
	} catch (caught) {
		return {
			group: params.group,
			...group,
			data: [],
			requestError: caught instanceof Error ? caught.message : 'Coolify request failed'
		};
	}
};

export const actions: Actions = {
	createProject: async ({ params, request, locals }) => {
		if (params.group !== 'projects') return fail(404, { error: 'Action not available', name: '' });
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
		redirect(303, `/manage/projects/${encodeURIComponent(createdUuid)}`);
	},
	systemAction: async ({ params, request, locals }) => {
		if (params.group !== 'system') return fail(404, { error: 'Action not available' });
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
			return { message: `${action.replace('-', ' ')} requested` };
		} catch (caught) {
			const status = caught instanceof CoolifyError ? caught.status : 500;
			return fail(status, {
				error: caught instanceof Error ? caught.message : 'Coolify request failed'
			});
		}
	}
};
