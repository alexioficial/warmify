import type { CoolifyMethod, CoolifyRequestOptions } from './coolify-client';
import { buildEndpointRequest, getEndpoint } from './endpoint-manifest';
import { redactSecrets } from './redact';

interface RequestingClient {
	request(method: CoolifyMethod, path: string, options?: CoolifyRequestOptions): Promise<unknown>;
}

export interface OperationInput {
	operationId: string;
	parameters: Record<string, string>;
	query: Record<string, string | number | boolean | undefined>;
	body: unknown;
	confirmation?: string;
}

export async function executeOperation(
	client: RequestingClient,
	input: OperationInput,
	revealSecrets = false
): Promise<unknown> {
	const endpoint = getEndpoint(input.operationId);
	if (endpoint.risk === 'delete') {
		const identifier = input.parameters[endpoint.pathParameters[0]];
		if (!identifier || input.confirmation !== identifier)
			throw new Error(`Type ${identifier || 'the resource identifier'} to confirm deletion`);
	}
	if (endpoint.risk === 'confirm' && input.confirmation !== 'confirm')
		throw new Error('Explicit confirmation is required');
	if (revealSecrets && (!endpoint.sensitive || endpoint.method !== 'GET'))
		throw new Error('Secret reveal is not allowed for this operation');

	const request = buildEndpointRequest(endpoint, input.parameters, {
		query: input.query,
		body: input.body
	});
	const result = await client.request(request.method, request.path, request.options ?? {});
	return revealSecrets ? result : redactSecrets(result);
}

export function parseJsonInput(value: FormDataEntryValue | null, label: string): unknown {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(`${label} must be valid JSON`);
	}
}

export function formDataToOperationInput(formData: FormData): OperationInput {
	const operationId = String(formData.get('operationId') ?? '');
	const endpoint = getEndpoint(operationId);
	const parameters = Object.fromEntries(
		endpoint.pathParameters.map((name) => [name, String(formData.get(`param:${name}`) ?? '')])
	);
	const queryValue = parseJsonInput(formData.get('query'), 'Query');
	if (
		queryValue !== undefined &&
		(!queryValue || typeof queryValue !== 'object' || Array.isArray(queryValue))
	) {
		throw new Error('Query must be a JSON object');
	}
	return {
		operationId,
		parameters,
		query: (queryValue ?? {}) as Record<string, string | number | boolean | undefined>,
		body: parseJsonInput(formData.get('body'), 'Body'),
		confirmation: String(formData.get('confirmation') ?? '')
	};
}
