import { describe, expect, it } from 'vitest';

import {
	LoginRateLimiter,
	createSessionToken,
	verifyPlainPassword,
	verifySessionToken
} from './auth';

describe('plain password verification', () => {
	it('verifies the configured password without hashing it in the environment', () => {
		expect(
			verifyPlainPassword('correct horse battery staple', 'correct horse battery staple')
		).toBe(true);
		expect(verifyPlainPassword('wrong', 'correct horse battery staple')).toBe(false);
	});
});

describe('session tokens', () => {
	it('round-trips a signed, unexpired session', () => {
		const token = createSessionToken('admin', 2_000, 's'.repeat(32));
		expect(verifySessionToken(token, 's'.repeat(32), 1_000)).toEqual({
			username: 'admin',
			expiresAt: 2_000
		});
	});

	it('rejects expired and tampered sessions', () => {
		const token = createSessionToken('admin', 2_000, 's'.repeat(32));
		expect(verifySessionToken(token, 's'.repeat(32), 2_001)).toBeNull();
		expect(verifySessionToken(`${token}x`, 's'.repeat(32), 1_000)).toBeNull();
	});
});

describe('LoginRateLimiter', () => {
	it('blocks an address after five failures for fifteen minutes', () => {
		const limiter = new LoginRateLimiter(5, 15 * 60_000);
		for (let attempt = 0; attempt < 5; attempt += 1) limiter.recordFailure('127.0.0.1', 0);
		expect(limiter.canAttempt('127.0.0.1', 1)).toBe(false);
		expect(limiter.canAttempt('127.0.0.1', 15 * 60_000 + 1)).toBe(true);
	});
});
