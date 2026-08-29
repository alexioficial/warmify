import { describe, expect, test } from 'vitest';

import { CoolifyError } from './coolify-client';
import { resourceGroups } from './resource-groups';
import {
	applicationDomainFailure,
	applicationDomainState,
	applicationDomainSubmission,
	configurationBody,
	configurationFailure,
	configurationSubmission,
	newResourceRequest,
	resourceActionRequest
} from './resource-actions';

describe('contextual resource actions', () => {
	test('maps lifecycle actions to allowlisted resource endpoints', () => {
		expect(resourceActionRequest('applications', 'app/1', 'start')).toEqual({
			method: 'POST',
			path: '/applications/app%2F1/start'
		});
		expect(resourceActionRequest('services', 'service-1', 'restart')).toEqual({
			method: 'POST',
			path: '/services/service-1/restart'
		});
		expect(resourceActionRequest('databases', 'db-1', 'stop')).toEqual({
			method: 'POST',
			path: '/databases/db-1/stop'
		});
	});

	test('maps application deploy to the documented deployment endpoint', () => {
		expect(resourceActionRequest('applications', 'app-1', 'deploy')).toEqual({
			method: 'POST',
			path: '/deploy',
			options: { query: { uuid: 'app-1' } }
		});
	});

	test('rejects actions unavailable for a resource family', () => {
		expect(() => resourceActionRequest('servers', 'server-1', 'start')).toThrow(
			'Action is not available'
		);
	});

	test('builds a typed configuration update without empty or unrelated fields', () => {
		const form = new FormData();
		form.set('name', 'Docs');
		form.set('description', 'Documentation');
		form.set('fqdn', '');
		form.set('ignored', 'secret');
		expect(configurationBody(form, ['name', 'description', 'fqdn'])).toEqual({
			name: 'Docs',
			description: 'Documentation',
			fqdn: ''
		});
	});

	test('allowlists and coerces fields owned by one application section', () => {
		const fields = (resourceGroups.applications.configurationFields ?? []).filter(
			(field) => field.section === 'runtime'
		);
		const form = new FormData();
		form.set('name', 'Must not cross section boundaries');
		form.set('custom_docker_run_options', '  --init  ');
		form.set('max_restart_count', '5');
		form.set('stop_grace_period', '');
		form.append('is_consistent_container_name_enabled', 'false');
		form.append('is_consistent_container_name_enabled', 'true');

		expect(configurationSubmission(form, fields)).toEqual({
			body: {
				custom_docker_run_options: '--init',
				max_restart_count: 5,
				stop_grace_period: null,
				is_consistent_container_name_enabled: true
			},
			values: {
				custom_docker_run_options: '--init',
				max_restart_count: '5',
				stop_grace_period: '',
				is_consistent_container_name_enabled: true
			},
			sensitiveValues: [],
			fieldErrors: {}
		});
	});

	test('encodes API text fields and excludes secrets from preserved values and errors', () => {
		const applicationFields = resourceGroups.applications.configurationFields ?? [];
		const labelFields = applicationFields.filter((field) => field.section === 'container-labels');
		const labelForm = new FormData();
		labelForm.set('custom_labels', 'traefik.enable=true');
		expect(configurationSubmission(labelForm, labelFields).body.custom_labels).toBe(
			Buffer.from('traefik.enable=true', 'utf8').toString('base64')
		);

		const securityFields = applicationFields.filter((field) => field.section === 'security');
		const securityForm = new FormData();
		securityForm.set('http_basic_auth_username', 'operator');
		securityForm.set('http_basic_auth_password', 'do-not-leak');
		const submission = configurationSubmission(securityForm, securityFields);
		expect(submission.values).toEqual({ http_basic_auth_username: 'operator' });
		expect(submission.sensitiveValues).toEqual(['do-not-leak']);

		const failure = configurationFailure(
			new CoolifyError('Password do-not-leak was rejected', 422, {
				message: 'Validation failed.',
				errors: {
					http_basic_auth_password: ['do-not-leak is invalid'],
					http_basic_auth_username: ['Username is required.'],
					name: ['This field is not allowed.']
				}
			}),
			securityFields,
			submission.sensitiveValues
		);
		expect(failure).toEqual({
			error: 'Password [REDACTED] was rejected',
			fieldErrors: {
				http_basic_auth_password: 'Invalid value',
				http_basic_auth_username: 'Username is required.'
			}
		});
		expect(JSON.stringify(failure)).not.toContain('do-not-leak');
	});

	test('presents application domains as rows with their noindex state', () => {
		expect(
			applicationDomainState({
				fqdn: 'https://docs.example.com, http://preview.example.com/path ',
				noindex_domains: ['http://preview.example.com/path'],
				redirect: 'non-www',
				settings: { is_force_https_enabled: true }
			})
		).toEqual({
			rows: [
				{ url: 'https://docs.example.com', noindex: false },
				{ url: 'http://preview.example.com/path', noindex: true }
			],
			redirect: 'non-www',
			forceHttps: true
		});
	});

	test('builds the documented domain PATCH body from structured rows', () => {
		const form = new FormData();
		form.append('domain', ' https://docs.example.com ');
		form.append('domain', 'http://preview.example.com/path');
		form.append('noindex_index', '1');
		form.set('redirect', 'www');
		form.set('is_force_https_enabled', 'true');

		expect(applicationDomainSubmission(form)).toEqual({
			body: {
				domains: 'https://docs.example.com,http://preview.example.com/path',
				noindex_domains: ['http://preview.example.com/path'],
				redirect: 'www',
				is_force_https_enabled: true
			},
			rows: [
				{ url: 'https://docs.example.com', noindex: false },
				{ url: 'http://preview.example.com/path', noindex: true }
			],
			redirect: 'www',
			forceHttps: true,
			rowErrors: {}
		});
	});

	test('rejects invalid and duplicate domains locally without dropping submitted rows', () => {
		const form = new FormData();
		form.append('domain', 'https://valid.example.com');
		form.append('domain', 'ftp://invalid.example.com');
		form.append('domain', 'https://valid.example.com');
		form.append('domain', 'https://localhost');
		form.append('noindex_index', '0');

		const submission = applicationDomainSubmission(form);
		expect(submission.body).toBeUndefined();
		expect(submission.rows).toEqual([
			{ url: 'https://valid.example.com', noindex: true },
			{ url: 'ftp://invalid.example.com', noindex: false },
			{ url: 'https://valid.example.com', noindex: false },
			{ url: 'https://localhost', noindex: false }
		]);
		expect(submission.rowErrors).toEqual({
			1: 'Use an absolute http:// or https:// URL.',
			2: 'This domain is already listed.',
			3: 'The hostname must be a fully qualified domain name or IP address.'
		});
	});

	test('maps a Coolify domain conflict without losing the submitted values', () => {
		const failure = applicationDomainFailure(
			new CoolifyError('Domain conflicts detected.', 409, {
				warning: 'The same domain is already in use.',
				conflicts: [
					{
						domain: 'https://docs.example.com',
						resource_name: 'Existing site',
						resource_uuid: 'other-app',
						resource_type: 'application',
						message: 'Domain already used'
					}
				]
			})
		);
		expect(failure).toEqual({
			error: 'Domain conflicts detected.',
			fieldError: undefined,
			warning: 'The same domain is already in use.',
			conflicts: [
				{
					domain: 'https://docs.example.com',
					resourceName: 'Existing site',
					resourceUuid: 'other-app',
					resourceType: 'application',
					message: 'Domain already used'
				}
			]
		});
	});

	test('builds typed create requests for the resource choices shown in the project UI', () => {
		const common = {
			projectUuid: 'project-1',
			serverUuid: 'server-1',
			environmentUuid: 'env-1',
			environmentName: 'production',
			name: 'Docs',
			description: '',
			destinationUuid: '',
			instantDeploy: true
		};
		expect(
			newResourceRequest({
				...common,
				kind: 'public-repository',
				fields: {
					git_repository: 'https://github.com/acme/docs',
					git_branch: 'main',
					build_pack: 'nixpacks'
				}
			})
		).toMatchObject({
			group: 'applications',
			request: {
				method: 'POST',
				path: '/applications/public',
				options: { body: { project_uuid: 'project-1', environment_uuid: 'env-1' } }
			}
		});
		expect(
			newResourceRequest({ ...common, kind: 'database', fields: { engine: 'postgresql' } })
		).toMatchObject({ group: 'databases', request: { path: '/databases/postgresql' } });
		expect(() =>
			newResourceRequest({ ...common, kind: 'database', fields: { engine: 'oracle' } })
		).toThrow('Unsupported database engine');
	});
});
