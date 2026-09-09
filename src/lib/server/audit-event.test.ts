import { expect, test } from 'vitest';

import { serializeAuditEvent } from './audit-event';

test('recursively redacts secret-shaped audit metadata and fixes trusted envelope fields', () => {
	const serialized = serializeAuditEvent(
		{
			operation: 'update-resource',
			api_token: 'audit-token-secret',
			nested: { password: 'audit-password-secret', uuid: 'app-1' },
			source: 'forged',
			timestamp: 'forged'
		},
		new Date('2026-09-08T12:00:00.000Z')
	);

	expect(JSON.parse(serialized)).toEqual({
		operation: 'update-resource',
		api_token: '[REDACTED]',
		nested: { password: '[REDACTED]', uuid: 'app-1' },
		source: 'warmify',
		timestamp: '2026-09-08T12:00:00.000Z'
	});
	expect(serialized).not.toMatch(/audit-token-secret|audit-password-secret|forged/);
});
