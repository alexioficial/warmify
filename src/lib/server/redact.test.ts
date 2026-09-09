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

	it('redacts values inside nested environment-variable collections', () => {
		const result = redactSecrets({
			name: 'app',
			environment_variables: [
				{ key: 'DATABASE_URL', value: 'secret-url', real_value: 'resolved-secret' }
			]
		});
		expect(result).toEqual({
			name: 'app',
			environment_variables: [
				{ key: 'DATABASE_URL', value: '[REDACTED]', real_value: '[REDACTED]' }
			]
		});
	});

	it('redacts cloud credentials and reusable script bodies', () => {
		expect(
			redactSecrets({
				name: 'Provisioning',
				token: 'provider-token-secret',
				script: '#!/bin/sh\necho cloud-init-secret'
			})
		).toEqual({
			name: 'Provisioning',
			token: '[REDACTED]',
			script: '[REDACTED]'
		});
	});

	it('redacts generic credential keys while preserving environment variable names', () => {
		expect(
			redactSecrets({
				storage: { key: 's3-access-key-secret', bucket: 'backups' },
				environment_variables: [{ key: 'DATABASE_URL', value: 'database-secret' }]
			})
		).toEqual({
			storage: { key: '[REDACTED]', bucket: 'backups' },
			environment_variables: [{ key: 'DATABASE_URL', value: '[REDACTED]' }]
		});
	});
});
