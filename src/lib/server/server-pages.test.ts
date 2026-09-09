import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));

import {
	loadServer,
	loadServerDomains,
	loadServerResources,
	serverActions,
	serverView
} from './server-pages';

const rawServer = {
	id: 42,
	uuid: 'server-1',
	name: 'Primary',
	description: 'Production host',
	ip: '192.0.2.10',
	port: 22,
	user: 'root',
	proxy: { type: 'TRAEFIK', secret: 'proxy-secret' },
	settings: {
		is_reachable: true,
		is_usable: false,
		is_build_server: false,
		concurrent_builds: 3,
		dynamic_timeout: 3600,
		deployment_queue_limit: 7,
		server_disk_usage_notification_threshold: 80,
		server_disk_usage_check_frequency: '0 0 * * *',
		connection_timeout: 10,
		is_terminal_enabled: true,
		sentinel_token: 'sentinel-secret',
		logdrain_axiom_api_key: 'axiom-secret'
	}
};

function event(values: Record<string, string> = {}, path = '/servers/server-1/general') {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		locals: { user: { username: 'admin' } },
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	invalidate.mockReset();
});

test('server presenter exposes only documented non-secret scalars', () => {
	const result = serverView(rawServer);
	expect(result).toMatchObject({
		uuid: 'server-1',
		name: 'Primary',
		ip: '192.0.2.10',
		isReachable: true,
		isUsable: false,
		concurrentBuilds: 3,
		isCoolifyHost: false
	});
	expect(JSON.stringify(result)).not.toMatch(/sentinel-secret|axiom-secret|proxy-secret|"id":42/);
});

test('server loader verifies route identity and never serializes raw settings', async () => {
	request.mockResolvedValue({ ...rawServer, uuid: 'server-1' });
	const result = await loadServer('server-1');
	expect(request).toHaveBeenCalledWith('GET', '/servers/server-1');
	expect(result.breadcrumbs.at(-1)).toEqual({
		label: 'Primary',
		href: '/servers/server-1/general'
	});
	expect(JSON.stringify(result)).not.toContain('sentinel-secret');
});

test('resource and domain loaders normalize only recognized safe fields', async () => {
	request
		.mockResolvedValueOnce([
			{
				uuid: 'app-1',
				name: 'Web',
				type: 'Application',
				status: 'running',
				secret: 'resource-secret'
			},
			{ uuid: 'db-1', name: 'DB', type: 'PostgreSQL', status: 'running' },
			{ uuid: 'odd-1', name: 'Odd', type: 'Unknown', status: 'unknown' }
		])
		.mockResolvedValueOnce([{ ip: '192.0.2.10', domains: ['example.com', 7, ''] }]);
	const resources = await loadServerResources('server-1');
	const domains = await loadServerDomains('server-1');
	expect(resources.resources.map((row) => row.href)).toEqual([
		'/applications/app-1/general',
		'/databases/db-1/general',
		undefined
	]);
	expect(JSON.stringify(resources)).not.toContain('resource-secret');
	expect(domains.domains).toEqual([{ ip: '192.0.2.10', domains: ['example.com'] }]);
});

test('general update owns route identity and sends one allowlisted PATCH', async () => {
	request.mockImplementation(async (method) =>
		method === 'GET' ? rawServer : { uuid: 'server-1', secret: 'response-secret' }
	);
	const result = await serverActions.updateGeneral(
		event({
			uuid: 'forged',
			name: 'Renamed',
			description: 'Updated',
			ip: '198.51.100.4',
			port: '2222',
			user: 'deploy'
		})
	);
	expect(result).toMatchObject({ message: 'Server settings saved.' });
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		[
			'PATCH',
			'/servers/server-1',
			{
				body: {
					name: 'Renamed',
					description: 'Updated',
					ip: '198.51.100.4',
					port: 2222,
					user: 'deploy'
				}
			}
		]
	]);
	expect(JSON.stringify(result)).not.toContain('response-secret');
	expect(invalidate).toHaveBeenCalledWith('servers');
});

test('validation requires fresh confirmation and posts once without retry', async () => {
	request.mockResolvedValue(rawServer);
	const rejected = await serverActions.validate(
		event({ install: 'true' }, '/servers/server-1/validation')
	);
	expect(rejected).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
	request.mockImplementation(async (method) =>
		method === 'GET' ? rawServer : { message: 'upstream-secret' }
	);
	const accepted = await serverActions.validate(
		event({ install: 'true', confirmation: 'confirm' }, '/servers/server-1/validation')
	);
	expect(accepted).toMatchObject({ message: 'Server validation and installation started.' });
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['POST', '/servers/server-1/validate', { body: { install: true } }]
	]);
	expect(JSON.stringify(accepted)).not.toContain('upstream-secret');
});

test('advanced update rejects invalid numeric settings before an API request', async () => {
	const result = await serverActions.updateAdvanced(
		event(
			{
				concurrent_builds: '0',
				dynamic_timeout: '3600',
				deployment_queue_limit: '25',
				server_disk_usage_notification_threshold: '80',
				server_disk_usage_check_frequency: 'daily',
				connection_timeout: '10'
			},
			'/servers/server-1/advanced'
		)
	);
	expect(result).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});

test('advanced update sends only the documented scalar settings', async () => {
	request.mockImplementation(async (method) =>
		method === 'GET' ? rawServer : { uuid: 'server-1', secret: 'response-secret' }
	);
	const result = await serverActions.updateAdvanced(
		event(
			{
				concurrent_builds: '4',
				dynamic_timeout: '7200',
				deployment_queue_limit: '30',
				server_disk_usage_notification_threshold: '90',
				server_disk_usage_check_frequency: '0 3 * * *',
				connection_timeout: '20',
				is_build_server: 'true',
				is_terminal_enabled: 'false',
				private_key_uuid: 'forged-key'
			},
			'/servers/server-1/advanced'
		)
	);
	expect(result).toMatchObject({ message: 'Advanced server settings saved.' });
	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1', {
		body: {
			concurrent_builds: 4,
			dynamic_timeout: 7200,
			deployment_queue_limit: 30,
			server_disk_usage_notification_threshold: 90,
			server_disk_usage_check_frequency: '0 3 * * *',
			connection_timeout: 20,
			is_build_server: true,
			is_terminal_enabled: false
		}
	});
	expect(JSON.stringify(result)).not.toContain('response-secret');
});

test('local Coolify host cannot be deleted', async () => {
	request.mockResolvedValueOnce({ ...rawServer, is_coolify_host: true });
	const result = await serverActions.delete(
		event({ confirmation: 'Primary' }, '/servers/server-1/danger')
	);
	expect(result).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);
});

test('force deletion needs both typed confirmations and redirects after one exact DELETE', async () => {
	request.mockResolvedValueOnce(rawServer);
	const missingPhrase = await serverActions.delete(
		event({ confirmation: 'Primary', force: 'true' }, '/servers/server-1/danger')
	);
	expect(missingPhrase).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);

	request.mockReset();
	request.mockResolvedValueOnce(rawServer).mockResolvedValueOnce({ message: 'Server deleted.' });
	await expect(
		serverActions.delete(
			event(
				{
					confirmation: 'server-1',
					force: 'true',
					force_confirmation: 'DELETE ALL RESOURCES'
				},
				'/servers/server-1/danger'
			)
		)
	).rejects.toMatchObject({ status: 303, location: '/servers' });
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['DELETE', '/servers/server-1?force=true']
	]);
});
