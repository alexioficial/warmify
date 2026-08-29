import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

const validEnv = {
	COOLIFY_BASE_URL: 'https://coolify.example.com/',
	COOLIFY_API_TOKEN: '1|secret',
	WARMIFY_ADMIN_USERNAME: 'admin',
	WARMIFY_ADMIN_PASSWORD: 'correct horse battery staple'
};

describe('loadConfig', () => {
	it('normalizes the Coolify API base URL and applies defaults', () => {
		expect(loadConfig(validEnv)).toMatchObject({
			coolifyBaseUrl: 'https://coolify.example.com/api/v1',
			sessionTtlHours: 12,
			requestTimeoutMs: 15_000
		});
		expect(loadConfig(validEnv).sessionSecret).not.toContain(validEnv.WARMIFY_ADMIN_PASSWORD);
	});

	it('accepts a URL that already includes the API prefix', () => {
		expect(
			loadConfig({ ...validEnv, COOLIFY_BASE_URL: 'https://coolify.example.com/api/v1/' })
				.coolifyBaseUrl
		).toBe('https://coolify.example.com/api/v1');
	});

	it('rejects missing required values without echoing secrets', () => {
		expect(() => loadConfig({ ...validEnv, WARMIFY_ADMIN_PASSWORD: '' })).toThrow(
			'WARMIFY_ADMIN_PASSWORD'
		);
	});
});
