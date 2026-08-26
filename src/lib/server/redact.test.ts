import { describe, expect, it } from 'vitest';

import { redactSecrets } from './redact';

describe('redactSecrets', () => {
	it('recursively redacts sensitive keys while preserving useful fields', () => {
		expect(
			redactSecrets({
				name: 'postgres',
				password: 'hunter2',
				nested: [{ api_token: 'secret', public_key: 'ssh-rsa AAA' }]
			})
		).toEqual({
			name: 'postgres',
			password: '[REDACTED]',
			nested: [{ api_token: '[REDACTED]', public_key: 'ssh-rsa AAA' }]
		});
	});
});
