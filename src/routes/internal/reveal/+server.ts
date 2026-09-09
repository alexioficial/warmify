import { error, json } from '@sveltejs/kit';

import { executeOperation } from '$lib/server/operations';
import { assertSameOrigin } from '$lib/server/internal-security';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	const user = assertSameOrigin(event);
	const value = (await request.json()) as {
		operationId?: string;
		parameters?: Record<string, string>;
	};
	if (
		!value ||
		typeof value !== 'object' ||
		typeof value.operationId !== 'string' ||
		value.operationId.length > 255 ||
		!value.parameters ||
		typeof value.parameters !== 'object' ||
		Array.isArray(value.parameters) ||
		Object.values(value.parameters).some(
			(parameter) => typeof parameter !== 'string' || parameter.length > 255
		)
	)
		error(400, 'Operation and parameters are required.');
	try {
		const result = await executeOperation(
			getCoolifyClient(),
			{ operationId: value.operationId, parameters: value.parameters, query: {}, body: undefined },
			true
		);
		audit({ user: user.username, operation: value.operationId, result: 'secret-revealed' });
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json(
			{ message: 'The requested sensitive response could not be revealed.' },
			{ status: 400, headers: { 'cache-control': 'no-store' } }
		);
	}
};
