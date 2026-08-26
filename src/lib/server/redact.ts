const SENSITIVE_KEY =
	/(?:^|_)(?:password|passwd|secret|token|private_key|client_secret|webhook_secret)(?:$|_)/i;

export function redactSecrets(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactSecrets);
	if (!value || typeof value !== 'object') return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, nestedValue]) => [
			key,
			SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSecrets(nestedValue)
		])
	);
}
