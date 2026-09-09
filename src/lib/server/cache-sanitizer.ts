import { redactSecrets } from '$lib/redact';

export function sanitizeCachedJson(value: string): string | undefined {
	try {
		return JSON.stringify(redactSecrets(JSON.parse(value)));
	} catch {
		return undefined;
	}
}
