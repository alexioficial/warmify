import { normalizeRecords } from '../resource-presenter';

import { CoolifyError } from './coolify-client';
import { redactSecrets } from './redact';

export interface ApplicationEnvironmentVariableBody {
	key: string;
	value: string;
	is_preview: boolean;
	is_literal: boolean;
	is_multiline: boolean;
	is_shown_once: boolean;
	is_runtime: boolean;
	is_buildtime: boolean;
	comment: string | null;
}

export interface ApplicationEnvironmentVariableValues {
	key: string;
	comment: string;
	isPreview: boolean;
	isLiteral: boolean;
	isMultiline: boolean;
	isShownOnce: boolean;
	isRuntime: boolean;
	isBuildtime: boolean;
}

export interface ApplicationEnvironmentVariableSubmission {
	body?: ApplicationEnvironmentVariableBody;
	values: ApplicationEnvironmentVariableValues;
	sensitiveValues: string[];
	fieldErrors: Record<string, string>;
}

export interface ApplicationEnvironmentVariableFailure {
	error: string;
	fieldErrors: Record<string, string>;
	retryAfterSeconds?: number;
	conflict: boolean;
}

export interface ApplicationEnvironmentBulkSubmission {
	body?: { data: ApplicationEnvironmentVariableBody[] };
	count: number;
	fieldErrors: Record<string, string>;
	sensitiveValues: string[];
}

const ENVIRONMENT_VALUE_KEYS = new Set(['value', 'real_value']);
const ENVIRONMENT_FIELDS = new Set([
	'key',
	'value',
	'is_preview',
	'is_literal',
	'is_multiline',
	'is_shown_once',
	'is_runtime',
	'is_buildtime',
	'comment'
]);
const ENVIRONMENT_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function booleanField(form: FormData, name: string, fallback = false): boolean {
	if (!form.has(name)) return fallback;
	const values = form.getAll(name);
	const value = String(values.at(-1) ?? '').toLowerCase();
	return ['true', '1', 'on', 'yes'].includes(value);
}

function redactEnvironmentValues(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactEnvironmentValues);
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, nested]) => [
			key,
			ENVIRONMENT_VALUE_KEYS.has(key) ? '[REDACTED]' : redactEnvironmentValues(nested)
		])
	);
}

function restoreEnvironmentVariableKeys(original: unknown, redacted: unknown): unknown {
	if (Array.isArray(original) && Array.isArray(redacted)) {
		return redacted.map((entry, index) => restoreEnvironmentVariableKeys(original[index], entry));
	}
	if (
		!original ||
		typeof original !== 'object' ||
		!redacted ||
		typeof redacted !== 'object' ||
		Array.isArray(redacted)
	) {
		return redacted;
	}

	const originalRecord = original as Record<string, unknown>;
	const redactedRecord = redacted as Record<string, unknown>;
	const isEnvironmentVariable =
		typeof originalRecord.key === 'string' &&
		('uuid' in originalRecord ||
			'id' in originalRecord ||
			'value' in originalRecord ||
			'real_value' in originalRecord ||
			'is_runtime' in originalRecord ||
			'is_buildtime' in originalRecord);

	return Object.fromEntries(
		Object.entries(redactedRecord).map(([key, nested]) => [
			key,
			key === 'key' && isEnvironmentVariable
				? originalRecord.key
				: restoreEnvironmentVariableKeys(originalRecord[key], nested)
		])
	);
}

export function redactApplicationEnvironmentVariables(value: unknown): unknown {
	return restoreEnvironmentVariableKeys(value, redactEnvironmentValues(redactSecrets(value)));
}

function validateKey(key: string): string | undefined {
	if (!key) return 'Variable key is required.';
	if (key.length > 255) return 'Variable key must be 255 characters or fewer.';
	if (!ENVIRONMENT_KEY_PATTERN.test(key)) {
		return 'Start with a letter or underscore and use only letters, numbers, underscores, and dots.';
	}
	return undefined;
}

function baseValues(form: FormData): ApplicationEnvironmentVariableValues {
	return {
		key: String(form.get('key') ?? '').trim(),
		comment: String(form.get('comment') ?? '').trim(),
		isPreview: booleanField(form, 'is_preview'),
		isLiteral: booleanField(form, 'is_literal'),
		isMultiline: booleanField(form, 'is_multiline'),
		isShownOnce: booleanField(form, 'is_shown_once'),
		isRuntime: booleanField(form, 'is_runtime', true),
		isBuildtime: booleanField(form, 'is_buildtime', true)
	};
}

export function applicationEnvironmentVariableSubmission(
	form: FormData
): ApplicationEnvironmentVariableSubmission {
	const values = baseValues(form);
	const value = String(form.get('value') ?? '');
	const fieldErrors: Record<string, string> = {};
	const keyError = validateKey(values.key);
	if (keyError) fieldErrors.key = keyError;
	if (!form.has('value')) fieldErrors.value = 'Variable value is required.';
	if (values.comment.length > 256) fieldErrors.comment = 'Comment must be 256 characters or fewer.';

	return {
		body:
			Object.keys(fieldErrors).length === 0
				? {
						key: values.key,
						value,
						is_preview: values.isPreview,
						is_literal: values.isLiteral,
						is_multiline: values.isMultiline,
						is_shown_once: values.isShownOnce,
						is_runtime: values.isRuntime,
						is_buildtime: values.isBuildtime,
						comment: values.comment || null
					}
				: undefined,
		values,
		sensitiveValues: value ? [value] : [],
		fieldErrors
	};
}

function stripSensitiveValues(message: string, sensitiveValues: readonly string[]): string {
	return sensitiveValues
		.filter(Boolean)
		.reduce((result, sensitive) => result.replaceAll(sensitive, '[REDACTED]'), message);
}

function firstError(value: unknown): string | undefined {
	const candidate = Array.isArray(value) ? value[0] : value;
	return candidate === undefined ? undefined : String(candidate);
}

export function applicationEnvironmentVariableFailure(
	caught: unknown,
	sensitiveValues: readonly string[]
): ApplicationEnvironmentVariableFailure {
	const status = caught instanceof CoolifyError ? caught.status : 500;
	const details =
		caught instanceof CoolifyError && caught.details && typeof caught.details === 'object'
			? (caught.details as Record<string, unknown>)
			: undefined;
	const errors =
		details?.errors && typeof details.errors === 'object'
			? (details.errors as Record<string, unknown>)
			: {};
	const fieldErrors: Record<string, string> = {};
	for (const [name, rawError] of Object.entries(errors)) {
		if (!ENVIRONMENT_FIELDS.has(name)) continue;
		fieldErrors[name] =
			name === 'value'
				? 'Invalid value.'
				: stripSensitiveValues(firstError(rawError) ?? 'Invalid value.', sensitiveValues);
	}

	let error = caught instanceof Error ? caught.message : 'Coolify request failed.';
	if (status === 401) error = 'Coolify rejected the configured API token.';
	if (status === 403) error = 'The Coolify token does not have permission to manage variables.';
	if (status === 409) error = 'A variable with this key and environment already exists.';
	if (status === 429) {
		error =
			caught instanceof CoolifyError && caught.retryAfterSeconds
				? `Coolify rate-limited this request. Retry in ${caught.retryAfterSeconds} seconds.`
				: 'Coolify rate-limited this request. Retry later.';
	}

	return {
		error: stripSensitiveValues(error, sensitiveValues),
		fieldErrors,
		retryAfterSeconds: caught instanceof CoolifyError ? caught.retryAfterSeconds : undefined,
		conflict: status === 409
	};
}

function parseBulkLines(
	input: string,
	isPreview: boolean,
	fieldName: string,
	fieldErrors: Record<string, string>,
	sensitiveValues: string[]
): ApplicationEnvironmentVariableBody[] {
	const rows: ApplicationEnvironmentVariableBody[] = [];
	const keys = new Set<string>();
	const lines = input.replaceAll('\r\n', '\n').split('\n');

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim() || line.trimStart().startsWith('#')) continue;
		const separator = line.indexOf('=');
		if (separator < 1) {
			fieldErrors[fieldName] = `Line ${index + 1} must use KEY=value.`;
			continue;
		}
		const key = line.slice(0, separator).trim();
		const value = line.slice(separator + 1);
		const keyError = validateKey(key);
		if (keyError) {
			fieldErrors[fieldName] = `Line ${index + 1}: ${keyError}`;
			continue;
		}
		if (keys.has(key)) {
			fieldErrors[fieldName] = `Line ${index + 1}: ${key} is duplicated.`;
			continue;
		}
		keys.add(key);
		if (value) sensitiveValues.push(value);
		rows.push({
			key,
			value,
			is_preview: isPreview,
			is_literal: false,
			is_multiline: false,
			is_shown_once: false,
			is_runtime: true,
			is_buildtime: true,
			comment: null
		});
	}
	return rows;
}

export function applicationEnvironmentBulkSubmission(
	form: FormData
): ApplicationEnvironmentBulkSubmission {
	const fieldErrors: Record<string, string> = {};
	const sensitiveValues: string[] = [];
	const data = [
		...parseBulkLines(
			String(form.get('production') ?? ''),
			false,
			'production',
			fieldErrors,
			sensitiveValues
		),
		...parseBulkLines(
			String(form.get('preview') ?? ''),
			true,
			'preview',
			fieldErrors,
			sensitiveValues
		)
	];
	if (data.length === 0 && Object.keys(fieldErrors).length === 0) {
		fieldErrors.production = 'Enter at least one KEY=value line.';
	}
	return {
		body: Object.keys(fieldErrors).length === 0 ? { data } : undefined,
		count: data.length,
		fieldErrors,
		sensitiveValues
	};
}

export function findEnvironmentVariable(value: unknown, uuid: string) {
	return normalizeRecords(value).find(
		(variable) => String(variable.uuid ?? variable.id ?? '') === uuid
	);
}
