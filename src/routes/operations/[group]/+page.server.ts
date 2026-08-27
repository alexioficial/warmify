import { fail } from '@sveltejs/kit';

import { CoolifyError } from '$lib/server/coolify-client';
import { endpointManifest, getEndpoint } from '$lib/server/endpoint-manifest';
import { invalidateAllCollections } from '$lib/server/inventory-cache';
import { executeOperation, formDataToOperationInput } from '$lib/server/operations';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({
	group: params.group,
	endpoints: endpointManifest.filter((endpoint) => endpoint.group === params.group)
});

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const started = Date.now();
		let operationId = '';
		try {
			const input = formDataToOperationInput(await request.formData());
			operationId = input.operationId;
			const endpoint = getEndpoint(operationId);
			if (endpoint.group !== params.group)
				return fail(400, { error: 'Operation does not belong to this group.' });
			const result = await executeOperation(getCoolifyClient(), input);
			if (endpoint.method !== 'GET') invalidateAllCollections();
			audit({
				user: locals.user?.username,
				operation: operationId,
				resource: Object.values(input.parameters)[0],
				result: 'success',
				duration_ms: Date.now() - started
			});
			return {
				operationId,
				result,
				reveal:
					endpoint.sensitive && endpoint.method === 'GET'
						? { operationId, parameters: input.parameters }
						: null
			};
		} catch (caught) {
			const status =
				caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
					? caught.status
					: 400;
			audit({
				user: locals.user?.username,
				operation: operationId,
				result: 'error',
				duration_ms: Date.now() - started
			});
			return fail(status, {
				operationId,
				error: caught instanceof Error ? caught.message : 'Operation failed'
			});
		}
	}
};
