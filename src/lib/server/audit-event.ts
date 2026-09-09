import { redactSecrets } from '$lib/redact';

export function serializeAuditEvent(
	event: Record<string, string | number | boolean | undefined | object>,
	now = new Date()
): string {
	return JSON.stringify(
		redactSecrets({
			...event,
			timestamp: now.toISOString(),
			source: 'warmify'
		})
	);
}
