import { expect, test } from 'vitest';

import { sanitizeCachedJson } from './cache-sanitizer';

test('rewrites historical cache JSON through recursive redaction', () => {
	expect(
		sanitizeCachedJson(
			JSON.stringify({
				name: 'Documentation',
				nested: { api_token: 'historical-token-secret' },
				environment_variables: [{ key: 'DATABASE_URL', value: 'historical-value-secret' }]
			})
		)
	).toBe(
		JSON.stringify({
			name: 'Documentation',
			nested: { api_token: '[REDACTED]' },
			environment_variables: [{ key: 'DATABASE_URL', value: '[REDACTED]' }]
		})
	);
});

test('marks malformed historical cache entries for deletion', () => {
	expect(sanitizeCachedJson('{not-json')).toBeUndefined();
});
