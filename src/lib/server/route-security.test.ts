import { describe, expect, it } from 'vitest';

import { isPublicPath } from './route-security';

describe('isPublicPath', () => {
	it('only exposes login and health without a session', () => {
		expect(isPublicPath('/login')).toBe(true);
		expect(isPublicPath('/health')).toBe(true);
		expect(isPublicPath('/projects')).toBe(false);
		expect(isPublicPath('/internal/poll/deployment/abc')).toBe(false);
	});
});
