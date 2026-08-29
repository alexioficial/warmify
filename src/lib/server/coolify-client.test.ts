import { describe, expect, it, vi } from 'vitest';

import { CoolifyClient } from './coolify-client';

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

	it('returns text for non-JSON endpoints', async () => {
		const client = new CoolifyClient({
			baseUrl: 'https://coolify.example.com/api/v1',
			token: '1|secret',
			timeoutMs: 1000,
			fetcher: async () => new Response('OK', { headers: { 'Content-Type': 'text/plain' } })
		});

		await expect(client.request('GET', '/health')).resolves.toBe('OK');
	});
});
