import { expect, test } from 'vitest';

import {
	assertInternalUser,
	assertSameOrigin,
	boundedPollIdentifier,
	boundedSearchQuery,
	boundedSubServiceName
} from './internal-security';

function event(overrides: Record<string, unknown> = {}) {
	return {
		locals: { user: { username: 'admin' } },
		request: new Request('https://warmify.example/internal', {
			method: 'POST',
			headers: { origin: 'https://warmify.example' }
		}),
		url: new URL('https://warmify.example/internal'),
		...overrides
	} as never;
}

test('requires a session and exact same origin for sensitive internal requests', () => {
	expect(assertInternalUser(event())).toEqual({ username: 'admin' });
	expect(() => assertInternalUser(event({ locals: { user: null } }))).toThrow();
	expect(() =>
		assertSameOrigin(
			event({
				request: new Request('https://warmify.example/internal', {
					method: 'POST',
					headers: { origin: 'https://attacker.example' }
				})
			})
		)
	).toThrow();
});

test('accepts bounded route identifiers and the explicit active deployment sentinel', () => {
	expect(boundedPollIdentifier('app_1-demo')).toBe('app_1-demo');
	expect(boundedPollIdentifier('active', true)).toBe('active');
	expect(() => boundedPollIdentifier('active')).toThrow();
	expect(() => boundedPollIdentifier('../secret')).toThrow();
	expect(() => boundedPollIdentifier('a'.repeat(256))).toThrow();
});

test('bounds search and service-log query values', () => {
	expect(boundedSearchQuery(`  ${'a'.repeat(200)}  `)).toHaveLength(200);
	expect(boundedSearchQuery('a'.repeat(201))).toHaveLength(200);
	expect(boundedSubServiceName('web.worker_1')).toBe('web.worker_1');
	expect(() => boundedSubServiceName('../worker')).toThrow();
});
