import { describe, expect, test } from 'vitest';

import {
	additionalData,
	deploymentDuration,
	deploymentSummary,
	environmentVariableSummary,
	formatRelativeTime,
	formatTimestamp,
	logText,
	normalizeRecords,
	projectEnvironments,
	projectStats,
	resourceSummary,
	versionLabel
} from './resource-presenter';
import * as resourcePresenter from './resource-presenter';

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
				environment: { name: 'production' },
				server: { name: 'primary' }
			})
		).toMatchObject({
			id: 'deploy-1',
			name: 'docs',
			rawStatus: 'in_progress',
			status: 'In progress',
			group: 'active',
			source: 'Manual',
			message: 'Document API',
			environment: 'production',
			server: 'primary'
		});
	});

	test('groups queued and completed deployments and formats their source and duration', () => {
		expect(
			deploymentSummary({
				deployment_uuid: 'deploy-2',
				status: 'queued',
				is_webhook: true,
				pull_request_id: 17
			})
		).toMatchObject({ status: 'Queued', group: 'queued', source: 'Webhook - PR #17' });
		expect(
			deploymentSummary({
				deployment_uuid: 'deploy-3',
				status: 'finished',
				created_at: '2026-08-30T12:00:00Z',
				finished_at: '2026-08-30T12:01:05Z'
			})
		).toMatchObject({ status: 'Success', group: 'completed', duration: '01m 05s' });
		expect(
			deploymentDuration(
				'2026-08-30T12:00:00Z',
				undefined,
				'in_progress',
				new Date('2026-08-30T13:02:03Z')
			)
		).toBe('01h 02m 03s');
	});

	test('counts nested project environments and resources for project summaries', () => {
		expect(
			projectStats({
				environments: [
					{
						applications: [{ uuid: 'app-1' }, { uuid: 'app-2' }],
						services: [{ uuid: 'service-1' }],
						databases: []
					},
					{ applications: [], services: [], databases: [{ uuid: 'database-1' }] }
				]
			})
		).toEqual({ environments: 2, resources: 4 });
	});

	test('formats recent activity as compact relative time', () => {
		expect(formatRelativeTime('2026-08-26T10:00:00Z', new Date('2026-08-26T12:00:00Z'))).toBe(
			'2 hours ago'
		);
		expect(formatRelativeTime('', new Date('2026-08-26T12:00:00Z'))).toBe('-');
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
			status: 'Running - healthy',
			context: 'production - Primary',
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
			additionalData(
				{
					name: 'docs',
					status: 'running',
					custom: 1,
					nested: { api_token: 'do-not-render', useful: true }
				},
				['name', 'status']
			)
		).toEqual({
			custom: 1,
			nested: { api_token: '[REDACTED]', useful: true }
		});
	});

	test('formats versions and timestamps without exposing raw JSON', () => {
		expect(versionLabel({ version: '4.0.0-beta.420' })).toBe('4.0.0-beta.420');
		expect(versionLabel({ error: 'offline' })).toBe('Unavailable');
		expect(formatTimestamp(undefined)).toBe('-');
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
			scope: 'Production',
			comment: '',
			isPreview: false,
			isLiteral: false,
			isMultiline: false,
			isShownOnce: false,
			isRuntime: true,
			isBuildtime: true
		});
		expect(logText({ logs: 'line one\nline two' })).toBe('line one\nline two');
		expect(logText([{ output: 'first' }, { message: 'second' }])).toBe('first\nsecond');
	});

	test('resolves an application back to its project and environment hierarchy', () => {
		const applicationHierarchy = (
			resourcePresenter as typeof resourcePresenter & {
				applicationHierarchy?: (
					application: unknown,
					projects: unknown
				) =>
					| {
							projectUuid: string;
							projectName: string;
							environmentUuid: string;
							environmentName: string;
					  }
					| undefined;
			}
		).applicationHierarchy;
		expect(applicationHierarchy).toBeTypeOf('function');
		if (!applicationHierarchy) return;

		expect(
			applicationHierarchy({ uuid: 'app-1', environment_id: 22 }, [
				{ uuid: 'project-1', name: 'Other', environments: [{ id: 10, uuid: 'env-1' }] },
				{
					uuid: 'project-2',
					name: 'Warmify',
					environments: [{ id: 22, uuid: 'env-2', name: 'production' }]
				}
			])
		).toEqual({
			projectUuid: 'project-2',
			projectName: 'Warmify',
			environmentUuid: 'env-2',
			environmentName: 'production'
		});
	});
});
