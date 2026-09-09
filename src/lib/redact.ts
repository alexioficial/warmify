const SENSITIVE_KEY =
	/(?:^|_)(?:password|passwd|secret|token|private_key|client_secret|webhook_secret)(?:$|_)/i;
const ENVIRONMENT_COLLECTION_KEY = /^(?:envs|environment_variables(?:_preview)?)$/i;
const ENVIRONMENT_VALUE_KEY = /^(?:value|real_value)$/i;
const SENSITIVE_DOCUMENT_KEY =
	/^(?:docker_compose_raw|docker_compose|content|script|internal_db_url|external_db_url|init_scripts|postgres_conf|mysql_conf|mariadb_conf|mongo_conf|redis_conf|keydb_conf)$/i;

function redactValue(value: unknown, environmentVariable = false): unknown {
	if (Array.isArray(value)) return value.map((entry) => redactValue(entry, environmentVariable));
	if (!value || typeof value !== 'object') return value;

	const record = value as Record<string, unknown>;
	const environmentRecord =
		environmentVariable ||
		(typeof record.key === 'string' && ('value' in record || 'real_value' in record));

	return Object.fromEntries(
		Object.entries(value).map(([key, nestedValue]) => [
			key,
			SENSITIVE_KEY.test(key) ||
			(!environmentRecord && key.toLowerCase() === 'key') ||
			SENSITIVE_DOCUMENT_KEY.test(key) ||
			(environmentRecord && ENVIRONMENT_VALUE_KEY.test(key))
				? '[REDACTED]'
				: redactValue(nestedValue, environmentRecord || ENVIRONMENT_COLLECTION_KEY.test(key))
		])
	);
}

export function redactSecrets(value: unknown): unknown {
	return redactValue(value);
}
