import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';

const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));

import {
	createCloudServerAction,
	loadCloudServerCreation,
	loadProviderOptionsAction
} from './provider-provisioning';

const tokens = [
	{ uuid: 'token-do', name: 'DO token', provider: 'digitalocean', token: 'do-secret' },
	{ uuid: 'token-hz', name: 'Hetzner token', provider: 'hetzner', token: 'hz-secret' },
	{ uuid: 'token-vu', name: 'Vultr token', provider: 'vultr', token: 'vu-secret' }
];
const keys = [
	{ uuid: 'key-1', name: 'Production key', description: 'SSH', private_key: 'key-secret' }
];
const scripts = [
	{
		uuid: 'script-1',
		name: 'Bootstrap',
		script: '#!/bin/sh\necho cloud-init-secret'
	}
];

const providerData: Record<string, unknown> = {
	'/digitalocean/regions': [{ slug: 'nyc3', name: 'New York 3', available: true }],
	'/digitalocean/sizes': [
		{ slug: 's-1vcpu-1gb', description: 'Basic', vcpus: 1, memory: 1024, price_monthly: 6 }
	],
	'/digitalocean/images': [{ id: 101, slug: 'ubuntu-24-04-x64', name: 'Ubuntu', public: true }],
	'/digitalocean/ssh-keys': [
		{ id: 100, name: 'Existing DO key', public_key: 'ssh-ed25519 provider-key-secret' }
	],
	'/hetzner/locations': [{ id: 1, name: 'nbg1', city: 'Nuremberg', country: 'DE' }],
	'/hetzner/server-types': [{ id: 2, name: 'cx22', cores: 2, memory: 4, disk: 40 }],
	'/hetzner/images': [{ id: 201, name: 'ubuntu-24.04', description: 'Ubuntu 24.04' }],
	'/hetzner/ssh-keys': [
		{ id: 200, name: 'Existing Hetzner key', public_key: 'provider-key-secret' }
	],
	'/hetzner/firewalls': [{ id: 300, name: 'Web firewall' }],
	'/hetzner/networks': [{ id: 400, name: 'Private network', ip_range: '10.0.0.0/16' }],
	'/vultr/regions': [{ id: 'ewr', city: 'New Jersey', country: 'US' }],
	'/vultr/plans': [{ id: 'vc2-1c-1gb', vcpu_count: 1, ram: 1024, disk: 25, monthly_cost: 6 }],
	'/vultr/os': [{ id: 301, name: 'Ubuntu 24.04', family: 'ubuntu' }],
	'/vultr/ssh-keys': [
		{ id: 'vultr-key', name: 'Existing Vultr key', ssh_key: 'provider-key-secret' }
	]
};

function installReadMocks(createdUuid = 'server-cloud') {
	request.mockImplementation(
		(method: string, path: string, options?: { body?: Record<string, unknown> }) => {
			if (method === 'GET' && path === '/cloud-tokens') return Promise.resolve(tokens);
			if (method === 'GET' && path === '/security/keys') return Promise.resolve(keys);
			if (method === 'GET' && path === '/cloud-init-scripts') return Promise.resolve(scripts);
			if (method === 'GET' && path === '/cloud-init-scripts/script-1')
				return Promise.resolve(scripts[0]);
			if (method === 'GET' && path in providerData) return Promise.resolve(providerData[path]);
			if (method === 'POST' && path.startsWith('/servers/'))
				return Promise.resolve({
					uuid: createdUuid,
					provider_response_secret: 'create-response-secret',
					body: options?.body
				});
			return Promise.reject(new Error(`Unexpected request ${method} ${path}`));
		}
	);
}

function event(provider: string, values: Record<string, string | undefined>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) form.append(key, value);
	}
	return {
		params: { provider },
		locals: { user: { username: 'admin' } },
		url: new URL(`http://localhost/servers/new/cloud/${provider}`),
		request: new Request(`http://localhost/servers/new/cloud/${provider}`, {
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

test('creation loader exposes only matching token, key and script metadata', async () => {
	installReadMocks();
	const result = await loadCloudServerCreation('digitalocean', vi.fn());
	expect(result.tokens).toEqual([
		expect.objectContaining({ uuid: 'token-do', provider: 'digitalocean' })
	]);
	expect(result.keys).toEqual([{ uuid: 'key-1', name: 'Production key', description: 'SSH' }]);
	expect(result.scripts).toEqual([
		expect.objectContaining({ uuid: 'script-1', name: 'Bootstrap' })
	]);
	expect(JSON.stringify(result)).not.toMatch(/do-secret|key-secret|cloud-init-secret/);
});

test('provider option discovery projects only selectable metadata', async () => {
	installReadMocks();
	const result = await loadProviderOptionsAction(
		event('digitalocean', { cloud_provider_token_uuid: 'token-do' })
	);
	expect(result).toMatchObject({
		provider: 'digitalocean',
		values: { cloudProviderTokenUuid: 'token-do' },
		options: {
			regions: [{ value: 'nyc3', label: expect.stringContaining('New York 3') }],
			sizes: [{ value: 's-1vcpu-1gb', label: expect.stringContaining('s-1vcpu-1gb') }],
			images: [{ value: 'ubuntu-24-04-x64', label: expect.stringContaining('Ubuntu') }],
			sshKeys: [{ value: '100', label: 'Existing DO key' }]
		}
	});
	expect(JSON.stringify(result)).not.toContain('provider-key-secret');
});

test('provisioning requires a fresh exact typed confirmation before any provider request', async () => {
	installReadMocks();
	const result = await createCloudServerAction(
		event('hetzner', {
			name: 'edge-hz',
			cloud_provider_token_uuid: 'token-hz',
			private_key_uuid: 'key-1',
			location: 'nbg1',
			size: 'cx22',
			image: '201',
			confirmation: 'wrong'
		})
	);
	expect(result).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});

test.each([
	{
		provider: 'digitalocean',
		values: {
			name: 'edge-do',
			cloud_provider_token_uuid: 'token-do',
			private_key_uuid: 'key-1',
			region: 'nyc3',
			size: 's-1vcpu-1gb',
			image: 'ubuntu-24-04-x64',
			ssh_key_ids: '100',
			cloud_init_script_uuid: 'script-1',
			enable_ipv6: 'true',
			monitoring: 'true',
			instant_validate: 'true',
			confirmation: 'PROVISION DIGITALOCEAN edge-do',
			forged: 'ignored'
		},
		body: {
			cloud_provider_token_uuid: 'token-do',
			region: 'nyc3',
			size: 's-1vcpu-1gb',
			image: 'ubuntu-24-04-x64',
			name: 'edge-do',
			private_key_uuid: 'key-1',
			enable_ipv6: true,
			monitoring: true,
			digitalocean_ssh_key_ids: [100],
			cloud_init_script: '#!/bin/sh\necho cloud-init-secret',
			instant_validate: true
		}
	},
	{
		provider: 'hetzner',
		values: {
			name: 'edge-hz',
			cloud_provider_token_uuid: 'token-hz',
			private_key_uuid: 'key-1',
			region: 'nbg1',
			size: 'cx22',
			image: '201',
			ssh_key_ids: '200',
			firewall_ids: '300',
			network_ids: '400',
			enable_ipv4: 'true',
			enable_ipv6: 'true',
			enable_backups: 'true',
			confirmation: 'PROVISION HETZNER edge-hz'
		},
		body: {
			cloud_provider_token_uuid: 'token-hz',
			location: 'nbg1',
			server_type: 'cx22',
			image: 201,
			name: 'edge-hz',
			private_key_uuid: 'key-1',
			enable_ipv4: true,
			enable_ipv6: true,
			enable_backups: true,
			hetzner_ssh_key_ids: [200],
			hetzner_firewall_ids: [300],
			hetzner_network_ids: [400],
			instant_validate: false
		}
	},
	{
		provider: 'vultr',
		values: {
			name: 'edge-vu',
			cloud_provider_token_uuid: 'token-vu',
			private_key_uuid: 'key-1',
			region: 'ewr',
			size: 'vc2-1c-1gb',
			image: '301',
			ssh_key_ids: 'vultr-key',
			enable_ipv6: 'true',
			disable_public_ipv4: 'false',
			confirmation: 'PROVISION VULTR edge-vu'
		},
		body: {
			cloud_provider_token_uuid: 'token-vu',
			region: 'ewr',
			plan: 'vc2-1c-1gb',
			os_id: 301,
			name: 'edge-vu',
			private_key_uuid: 'key-1',
			enable_ipv6: true,
			disable_public_ipv4: false,
			vultr_ssh_key_ids: ['vultr-key'],
			instant_validate: false
		}
	}
])('sends one exact allowlisted $provider creation request', async ({ provider, values, body }) => {
	installReadMocks(`server-${provider}`);
	await expect(createCloudServerAction(event(provider, values))).rejects.toMatchObject({
		status: 303,
		location: `/servers/server-${provider}/general`
	});
	expect(request).toHaveBeenCalledWith('POST', `/servers/${provider}`, { body });
	expect(invalidate).toHaveBeenCalledWith('servers');
});

test('uncertain provider failures are safe and explicitly discourage retry', async () => {
	installReadMocks();
	request.mockImplementationOnce(() => {
		throw new CoolifyError('provider-account-secret', 500);
	});
	const result = await createCloudServerAction(
		event('vultr', {
			name: 'edge-vu',
			confirmation: 'PROVISION VULTR edge-vu'
		})
	);
	expect(result).toMatchObject({ status: 500 });
	expect(JSON.stringify(result)).not.toContain('provider-account-secret');
	expect(JSON.stringify(result)).toContain(
		'Check both Coolify and the provider before trying again'
	);
});
