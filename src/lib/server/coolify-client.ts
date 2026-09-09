import { redactSecrets } from '$lib/redact';

export type CoolifyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CoolifyRequestOptions {
	body?: unknown;
	query?: Record<string, string | number | boolean | undefined>;
}

export class CoolifyError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly details?: unknown,
		readonly retryAfterSeconds?: number
	) {
		super(message);
		this.name = 'CoolifyError';
	}
}

interface CoolifyClientOptions {
	baseUrl: string;
	token: string;
	timeoutMs: number;
	fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

async function parseResponse(response: Response): Promise<unknown> {
	if (response.status === 204) return undefined;
	const text = await response.text();
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function collectSensitiveValues(original: unknown, redacted: unknown, values: Set<string>): void {
	if (typeof original === 'string' && redacted === '[REDACTED]') {
		if (original.length >= 3) values.add(original);
		return;
	}
	if (Array.isArray(original) && Array.isArray(redacted)) {
		original.forEach((value, index) => collectSensitiveValues(value, redacted[index], values));
		return;
	}
	if (
		original &&
		redacted &&
		typeof original === 'object' &&
		typeof redacted === 'object' &&
		!Array.isArray(original) &&
		!Array.isArray(redacted)
	) {
		for (const [key, value] of Object.entries(original)) {
			collectSensitiveValues(value, (redacted as Record<string, unknown>)[key], values);
		}
	}
}

function replaceSensitiveStrings(value: unknown, secrets: readonly string[]): unknown {
	if (typeof value === 'string') {
		return secrets.reduce((result, secret) => result.split(secret).join('[REDACTED]'), value);
	}
	if (Array.isArray(value)) return value.map((entry) => replaceSensitiveStrings(entry, secrets));
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, nested]) => [key, replaceSensitiveStrings(nested, secrets)])
	);
}

function safeErrorData(data: unknown, token: string, body: unknown): unknown {
	const redactedBody = redactSecrets(body);
	const values = new Set<string>(token.length >= 3 ? [token] : []);
	collectSensitiveValues(body, redactedBody, values);
	return replaceSensitiveStrings(
		redactSecrets(data),
		[...values].sort((a, b) => b.length - a.length)
	);
}

export class CoolifyClient {
	private readonly baseUrl: string;
	private readonly token: string;
	private readonly timeoutMs: number;
	private readonly fetcher: (
		input: string | URL | Request,
		init?: RequestInit
	) => Promise<Response>;

	constructor(options: CoolifyClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/$/, '');
		this.token = options.token;
		this.timeoutMs = options.timeoutMs;
		this.fetcher = options.fetcher ?? fetch;
	}

	async request<T = unknown>(
		method: CoolifyMethod,
		path: string,
		options: CoolifyRequestOptions = {}
	): Promise<T> {
		if (!path.startsWith('/') || path.includes('..') || /^\/\//.test(path))
			throw new Error('Coolify request path is not allowed');
		const url = new URL(`${this.baseUrl}${path}`);
		for (const [key, value] of Object.entries(options.query ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		try {
			const response = await this.fetcher(url.toString(), {
				method,
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${this.token}`,
					...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
				},
				body: options.body === undefined ? undefined : JSON.stringify(options.body),
				signal: controller.signal
			});
			const data = await parseResponse(response);
			if (!response.ok) {
				const safeData = safeErrorData(data, this.token, options.body);
				const message =
					typeof safeData === 'object' &&
					safeData &&
					'message' in safeData &&
					typeof safeData.message === 'string'
						? safeData.message
						: `Coolify request failed with status ${response.status}`;
				const retryAfter = Number(response.headers.get('Retry-After'));
				throw new CoolifyError(
					message,
					response.status,
					safeData,
					Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
				);
			}
			return data as T;
		} catch (error) {
			if (error instanceof CoolifyError) throw error;
			if (controller.signal.aborted) throw new CoolifyError('Coolify request timed out', 504);
			const safeMessage = replaceSensitiveStrings(
				error instanceof Error ? error.message : 'Unable to reach Coolify',
				[this.token]
			);
			throw new CoolifyError(
				typeof safeMessage === 'string' ? safeMessage : 'Unable to reach Coolify',
				502
			);
		} finally {
			clearTimeout(timeout);
		}
	}
}
