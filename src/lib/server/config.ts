import { createHash } from 'node:crypto';

export interface WarmifyConfig {
	coolifyBaseUrl: string;
	coolifyApiToken: string;
	adminUsername: string;
	adminPassword: string;
	sessionSecret: string;
	sessionTtlHours: number;
	requestTimeoutMs: number;
	dataDir: string;
}

function required(env: Record<string, string | undefined>, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0)
		throw new Error(`${name} must be a positive integer`);
	return parsed;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): WarmifyConfig {
	const rawUrl = required(env, 'COOLIFY_BASE_URL');
	const url = new URL(rawUrl);
	if (!['http:', 'https:'].includes(url.protocol))
		throw new Error('COOLIFY_BASE_URL must use HTTP or HTTPS');
	const pathname = url.pathname.replace(/\/+$/, '');
	url.pathname = pathname.endsWith('/api/v1') ? pathname : `${pathname}/api/v1`;
	url.search = '';
	url.hash = '';

	const adminPassword = required(env, 'WARMIFY_ADMIN_PASSWORD');
	const sessionSecret = createHash('sha256')
		.update('warmify-session-v1\0')
		.update(adminPassword)
		.digest('base64url');

	return {
		coolifyBaseUrl: url.toString().replace(/\/$/, ''),
		coolifyApiToken: required(env, 'COOLIFY_API_TOKEN'),
		adminUsername: required(env, 'WARMIFY_ADMIN_USERNAME'),
		adminPassword,
		sessionSecret,
		sessionTtlHours: positiveInteger(
			env.WARMIFY_SESSION_TTL_HOURS,
			12,
			'WARMIFY_SESSION_TTL_HOURS'
		),
		requestTimeoutMs: positiveInteger(
			env.WARMIFY_REQUEST_TIMEOUT_MS,
			15_000,
			'WARMIFY_REQUEST_TIMEOUT_MS'
		),
		dataDir: env.WARMIFY_DATA_DIR?.trim() || '.warmify-data'
	};
}
