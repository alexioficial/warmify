import { afterEach, describe, expect, it, vi } from 'vitest';

import { CoolifyClient } from './coolify-client';

afterEach(() => vi.useRealTimers());

describe('CoolifyClient', () => {
	it('sends bearer-authenticated JSON requests to allowlisted paths', async () => {
		const fetcher = vi.fn(
			async () => new Response(JSON.stringify({ uuid: 'project-1' }), { status: 200 })
		);
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|secret',
			timeoutMs: 1000,
			fetcher
		});

		await expect(client.request('GET', '/projects')).resolves.toEqual({ uuid: 'project-1' });
		expect(fetcher).toHaveBeenCalledWith(
			'https://coolify.example.com/api/v1/projects',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer 1|secret' })
			})
		);
	});

	it('normalizes API errors and exposes retry-after', async () => {
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|secret',
			timeoutMs: 1000,
			fetcher: async () =>
				new Response(JSON.stringify({ message: 'Slow down' }), {
					status: 429,
					headers: { 'Retry-After': '12' }
				})
		});

		await expect(client.request('GET', '/projects')).rejects.toMatchObject({
			status: 429,
			message: 'Slow down',
			retryAfterSeconds: 12
		});
	});

	it('redacts configured and submitted secrets from upstream error messages and details', async () => {
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|configured-secret',
			timeoutMs: 1000,
			fetcher: async () =>
				new Response(
					JSON.stringify({
						message: 'Rejected 1|configured-secret and submitted-token-secret',
						errors: { api_token: 'submitted-token-secret' }
					}),
					{ status: 422 }
				)
		});

		let failure: unknown;
		try {
			await client.request('PATCH', '/applications/app-1', {
				body: { api_token: 'submitted-token-secret' }
			});
		} catch (caught) {
			failure = caught;
		}
		expect(failure).toMatchObject({
			status: 422,
			message: 'Rejected [REDACTED] and [REDACTED]',
			details: {
				message: 'Rejected [REDACTED] and [REDACTED]',
				errors: { api_token: '[REDACTED]' }
			}
		});
		expect(JSON.stringify(failure)).not.toMatch(/configured-secret|submitted-token-secret/);
	});

	it('returns text for non-JSON endpoints', async () => {
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|secret',
			timeoutMs: 1000,
			fetcher: async () => new Response('OK', { headers: { 'Content-Type': 'text/plain' } })
		});

		await expect(client.request('GET', '/health')).resolves.toBe('OK');
	});

	it('bounds upstream requests with a timeout and a safe gateway status', async () => {
		vi.useFakeTimers();
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|configured-secret',
			timeoutMs: 25,
			fetcher: async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('aborted', 'AbortError'))
					);
				})
		});

		const pending = expect(client.request('GET', '/projects')).rejects.toMatchObject({
			status: 504,
			message: 'Coolify request timed out'
		});
		await vi.advanceTimersByTimeAsync(26);
		await pending;
	});
});
