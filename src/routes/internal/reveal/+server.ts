import { error, json } from '@sveltejs/kit';

import { executeOperation } from '$lib/server/operations';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const value = (await request.json()) as {
		operationId?: string;
		parameters?: Record<string, string>;
	};
	if (!value.operationId || !value.parameters) error(400, 'Operation and parameters are required');
	try {
		const result = await executeOperation(
			getCoolifyClient(),
			{ operationId: value.operationId, parameters: value.parameters, query: {}, body: undefined },
			true
		);
		audit({ user: locals.user?.username, operation: value.operationId, result: 'secret-revealed' });
		return json(result);
	} catch (caught) {
		error(400, caught instanceof Error ? caught.message : 'Reveal failed');
	}
};
