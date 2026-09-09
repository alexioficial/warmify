import { describe, expect, test } from 'vitest';
import {
	serviceDomainRows,
	serviceDomainSubmission,
	serviceOverview,
	serviceOperationBody,
	serviceVariableBody
} from './service-operation-presenter';
import { redactSecrets } from './redact';

const service = {
	applications: [
		{
			uuid: 'web-1',
			name: 'web',
			human_name: 'Website',
			fqdn: 'https://web.example.com',
			password: 'hidden'
		}
	]
};
function form(values: Record<string, string>) {
	const result = new FormData();
	for (const [key, value] of Object.entries(values)) result.set(key, value);
	return result;
}

describe('service contracts', () => {
	test('presents only safe public links and infrastructure metadata', () => {
		expect(
			serviceOverview({
				type: 'wordpress',
				destination: { name: 'Docker', server: { name: 'Primary' } },
				applications: [
					{
						name: 'web',
						fqdn: 'https://example.com, javascript:alert(1), https://user:pass@example.com'
					}
				],
				databases: [{ name: 'db' }]
			})
		).toEqual({
			type: 'wordpress',
			destination: 'Docker',
			server: 'Primary',
			applications: 1,
			databases: 1,
			links: [{ name: 'web', url: 'https://example.com/' }]
		});
	});
	test('uses compose names rather than human names and retains only domain metadata', () => {
		expect(serviceDomainRows(service)).toEqual([
			{ name: 'web', label: 'Website', url: 'https://web.example.com' }
		]);
	});
	test('rejects unknown containers and unsafe URLs while allowing explicit domain clearing', () => {
		expect(
			serviceDomainSubmission(form({ name: 'other', url: 'https://x.example.com' }), service).body
		).toBeUndefined();
		for (const url of ['javascript:alert(1)', 'https://user:pass@example.com']) {
			expect(serviceDomainSubmission(form({ name: 'web', url }), service).body).toBeUndefined();
		}
		expect(serviceDomainSubmission(form({ name: 'web', url: '' }), service).body).toEqual({
			urls: [{ name: 'web', url: '' }]
		});
	});
	test('sends only the fields specific to each operation', () => {
		const input = form({
			destination_uuid: 'dest-1',
			environment_uuid: 'env-1',
			name: 'Copy',
			clone_volumes: 'true',
			migrate_volumes: 'false'
		});
		expect(serviceOperationBody('clone', input)).toEqual({
			destination_uuid: 'dest-1',
			name: 'Copy',
			clone_volumes: true
		});
		expect(serviceOperationBody('move', input)).toEqual({ environment_uuid: 'env-1' });
		expect(serviceOperationBody('migrate', input)).toEqual({
			destination_uuid: 'dest-1',
			migrate_volumes: false
		});
		expect(() => serviceOperationBody('clone', new FormData())).toThrow();
	});
	test('never sends application-only variable options to a service', () => {
		expect(
			serviceVariableBody({
				key: 'MODE',
				value: 'prod',
				is_preview: true,
				is_buildtime: true,
				is_runtime: true,
				is_literal: false,
				comment: null
			})
		).toEqual({ key: 'MODE', value: 'prod', is_literal: false, comment: null });
	});
	test('redacts compose and managed-file contents recursively before cache or SSR', () => {
		const result = JSON.stringify(
			redactSecrets({
				docker_compose_raw: 'compose-secret',
				nested: { docker_compose: 'rendered-secret', content: 'file-secret' },
				name: 'Stack'
			})
		);
		expect(result).not.toContain('compose-secret');
		expect(result).not.toContain('rendered-secret');
		expect(result).not.toContain('file-secret');
		expect(result).toContain('Stack');
	});
});
