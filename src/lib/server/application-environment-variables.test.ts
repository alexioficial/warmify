import { describe, expect, test } from 'vitest';

import {
	applicationEnvironmentBulkSubmission,
	applicationEnvironmentVariableFailure,
	applicationEnvironmentVariableSubmission,
	redactApplicationEnvironmentVariables
} from './application-environment-variables';
import { CoolifyError } from './coolify-client';

describe('application environment variables', () => {
	test('redacts values returned to SSR while preserving variable metadata', () => {
		const result = redactApplicationEnvironmentVariables([
			{
				uuid: 'env-1',
				key: 'DATABASE_URL',
				value: 'postgres://secret',
				real_value: 'postgres://resolved-secret',
				comment: 'Database connection',
				is_runtime: true
			}
		]);

		expect(result).toEqual([
			{
				uuid: 'env-1',
				key: 'DATABASE_URL',
				value: '[REDACTED]',
				real_value: '[REDACTED]',
				comment: 'Database connection',
				is_runtime: true
			}
		]);
		expect(JSON.stringify(result)).not.toContain('postgres://secret');
	});

	test('builds the exact application env shape and does not preserve its secret value', () => {
		const form = new FormData();
		form.set('key', 'DATABASE.URL');
		form.set('value', 'do-not-return');
		form.set('comment', 'Primary database');
		form.set('is_preview', 'true');
		form.set('is_literal', 'true');
		form.set('is_multiline', 'false');
		form.set('is_shown_once', 'true');
		form.set('is_runtime', 'false');
		form.set('is_buildtime', 'true');

		const submission = applicationEnvironmentVariableSubmission(form);
		expect(submission.body).toEqual({
			key: 'DATABASE.URL',
			value: 'do-not-return',
			comment: 'Primary database',
			is_preview: true,
			is_literal: true,
			is_multiline: false,
			is_shown_once: true,
			is_runtime: false,
			is_buildtime: true
		});
		expect(submission.values).not.toHaveProperty('value');
		expect(submission.sensitiveValues).toEqual(['do-not-return']);
	});

	test('validates keys and comments before calling Coolify', () => {
		const form = new FormData();
		form.set('key', 'INVALID-KEY');
		form.set('value', 'secret');
		form.set('comment', 'x'.repeat(257));
		const submission = applicationEnvironmentVariableSubmission(form);
		expect(submission.body).toBeUndefined();
		expect(submission.fieldErrors).toEqual({
			key: 'Start with a letter or underscore and use only letters, numbers, underscores, and dots.',
			comment: 'Comment must be 256 characters or fewer.'
		});
	});

	test('parses production and preview KEY=value blocks into the documented bulk body', () => {
		const form = new FormData();
		form.set('production', '# comment\nAPI_URL=https://api.example.com\nEMPTY=');
		form.set('preview', 'API_URL=https://preview.example.com');
		const submission = applicationEnvironmentBulkSubmission(form);

		expect(submission.fieldErrors).toEqual({});
		expect(submission.body?.data).toHaveLength(3);
		expect(submission.body?.data[0]).toMatchObject({
			key: 'API_URL',
			value: 'https://api.example.com',
			is_preview: false,
			is_runtime: true,
			is_buildtime: true
		});
		expect(submission.body?.data[2]).toMatchObject({
			key: 'API_URL',
			value: 'https://preview.example.com',
			is_preview: true
		});
	});

	test('maps validation, conflict, permission, and rate-limit failures without leaking values', () => {
		const validation = applicationEnvironmentVariableFailure(
			new CoolifyError('Value do-not-leak failed.', 422, {
				errors: { value: ['do-not-leak is invalid'], key: ['Key is invalid.'], ignored: ['no'] }
			}),
			['do-not-leak']
		);
		expect(validation).toEqual({
			error: 'Value [REDACTED] failed.',
			fieldErrors: { value: 'Invalid value.', key: 'Key is invalid.' },
			retryAfterSeconds: undefined,
			conflict: false
		});
		expect(JSON.stringify(validation)).not.toContain('do-not-leak');
		expect(
			applicationEnvironmentVariableFailure(new CoolifyError('Forbidden', 403), []).error
		).toBe('The Coolify token does not have permission to manage variables.');
		expect(
			applicationEnvironmentVariableFailure(new CoolifyError('Conflict', 409), [])
		).toMatchObject({
			conflict: true,
			error: 'A variable with this key and environment already exists.'
		});
		expect(
			applicationEnvironmentVariableFailure(new CoolifyError('Limited', 429, undefined, 12), [])
		).toMatchObject({ error: 'Coolify rate-limited this request. Retry in 12 seconds.' });
	});
});
