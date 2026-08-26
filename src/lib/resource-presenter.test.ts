import { describe, expect, test } from 'vitest';

import {
	additionalData,
	deploymentSummary,
	environmentVariableSummary,
	formatTimestamp,
	logText,
	normalizeRecords,
	projectEnvironments,
	resourceSummary,
	versionLabel
} from './resource-presenter';

describe('resource presenter', () => {
	test('normalizes plain arrays and common API response wrappers', () => {
		const rows = [{ uuid: 'one' }];
		expect(normalizeRecords(rows)).toEqual(rows);
		expect(normalizeRecords({ data: rows })).toEqual(rows);
		expect(normalizeRecords({ deployments: rows })).toEqual(rows);
		expect(normalizeRecords({ error: 'offline' })).toEqual([]);
	});

	test('turns a deployment object into readable fields without serializing nested values', () => {
		expect(
			deploymentSummary({
				deployment_uuid: 'deploy-1',
				application_name: 'docs',
				status: 'in_progress',
				commit_message: 'Document API',
				created_at: '2026-08-26T01:00:00Z',
				server: { name: 'primary' }
			})
		).toMatchObject({
			id: 'deploy-1',
			name: 'docs',
			status: 'In progress',
			message: 'Document API'
		});
	});

	test('summarizes resources by family using deliberate fields', () => {
		expect(
			resourceSummary(
				{
					uuid: 'app-1',
					name: 'Website',
					status: 'running:healthy',
					fqdn: 'https://example.com',
					environment: { name: 'production' },
					server: { name: 'Primary' }
				},
				'applications'
			)
		).toEqual({
			id: 'app-1',
			name: 'Website',
			description: 'https://example.com',
			status: 'Running · healthy',
			context: 'production · Primary',
			type: 'Application'
		});
	});

	test('extracts project environments and their nested resources', () => {
		const environments = projectEnvironments({
			environments: [
				{
					uuid: 'env-1',
					name: 'production',
					applications: [{ uuid: 'app-1', name: 'Website' }],
					services: [{ uuid: 'svc-1', name: 'Plausible' }],
					databases: [{ uuid: 'db-1', name: 'Postgres' }]
				}
			]
		});

		expect(environments).toHaveLength(1);
		expect(environments[0].resources.map((resource) => resource.group)).toEqual([
			'applications',
			'services',
			'databases'
		]);
	});

	test('keeps only unknown response fields for the secondary details section', () => {
		expect(
			additionalData({ name: 'docs', status: 'running', custom: 1 }, ['name', 'status'])
		).toEqual({
			custom: 1
		});
	});

	test('formats versions and timestamps without exposing raw JSON', () => {
		expect(versionLabel({ version: '4.0.0-beta.420' })).toBe('4.0.0-beta.420');
		expect(versionLabel({ error: 'offline' })).toBe('Unavailable');
		expect(formatTimestamp(undefined)).toBe('—');
		expect(formatTimestamp('not-a-date')).toBe('not-a-date');
	});

	test('presents environment variables and logs through their domain fields', () => {
		expect(
			environmentVariableSummary({
				uuid: 'env-1',
				key: 'DATABASE_URL',
				value: '[REDACTED]',
				is_build_time: true,
				is_preview: false
			})
		).toEqual({
			id: 'env-1',
			key: 'DATABASE_URL',
			value: '[REDACTED]',
			scope: 'Build time'
		});
		expect(logText({ logs: 'line one\nline two' })).toBe('line one\nline two');
		expect(logText([{ output: 'first' }, { message: 'second' }])).toBe('first\nsecond');
	});
});
