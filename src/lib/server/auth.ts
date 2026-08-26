import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function verifyPlainPassword(supplied: string, configured: string): boolean {
	const suppliedDigest = createHash('sha256').update(supplied).digest();
	const configuredDigest = createHash('sha256').update(configured).digest();
	return timingSafeEqual(suppliedDigest, configuredDigest);
}

export interface SessionPayload {
	username: string;
	expiresAt: number;
}

function signature(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(username: string, expiresAt: number, secret: string): string {
	const payload = Buffer.from(JSON.stringify({ username, expiresAt }), 'utf8').toString(
		'base64url'
	);
	return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(
	token: string | undefined,
	secret: string,
	now = Date.now()
): SessionPayload | null {
	try {
		if (!token) return null;
		const [payload, suppliedSignature] = token.split('.');
		if (!payload || !suppliedSignature) return null;
		const expectedSignature = signature(payload, secret);
		const expected = Buffer.from(expectedSignature);
		const supplied = Buffer.from(suppliedSignature);
		if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
		const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
		if (
			typeof parsed.username !== 'string' ||
			typeof parsed.expiresAt !== 'number' ||
			parsed.expiresAt <= now
		)
			return null;
		return parsed;
	} catch {
		return null;
	}
}

export class LoginRateLimiter {
	private readonly failures = new Map<string, number[]>();

	constructor(
		private readonly maximumFailures = 5,
		private readonly windowMs = 15 * 60_000
	) {}

	canAttempt(address: string, now = Date.now()): boolean {
		const recent = (this.failures.get(address) ?? []).filter(
			(timestamp) => now - timestamp < this.windowMs
		);
		if (recent.length) this.failures.set(address, recent);
		else this.failures.delete(address);
		return recent.length < this.maximumFailures;
	}

	recordFailure(address: string, now = Date.now()): void {
		const recent = (this.failures.get(address) ?? []).filter(
			(timestamp) => now - timestamp < this.windowMs
		);
		recent.push(now);
		this.failures.set(address, recent);
	}

	reset(address: string): void {
		this.failures.delete(address);
	}
}
