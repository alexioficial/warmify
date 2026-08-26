export type CoolifyMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

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
				const message =
					typeof data === 'object' && data && 'message' in data && typeof data.message === 'string'
						? data.message
						: `Coolify request failed with status ${response.status}`;
				const retryAfter = Number(response.headers.get('Retry-After'));
				throw new CoolifyError(
					message,
					response.status,
					data,
					Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
				);
			}
			return data as T;
		} catch (error) {
			if (error instanceof CoolifyError) throw error;
			if (controller.signal.aborted) throw new CoolifyError('Coolify request timed out', 504);
			throw new CoolifyError(
				error instanceof Error ? error.message : 'Unable to reach Coolify',
				502
			);
		} finally {
			clearTimeout(timeout);
		}
	}
}
