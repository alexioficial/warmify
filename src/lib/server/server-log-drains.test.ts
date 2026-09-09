import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));

import { loadServerLogDrains, logDrainActions, revealLogDrainSecrets } from './server-log-drains';

const server = { uuid: 'server-1', name: 'Primary', settings: { is_reachable: true } };
const drains = {
	is_logdrain_newrelic_enabled: true,
	logdrain_newrelic_license_key: 'newrelic-secret',
	logdrain_newrelic_base_uri: 'https://log-api.newrelic.com',
	is_logdrain_axiom_enabled: true,
	logdrain_axiom_dataset_name: 'production',
	logdrain_axiom_api_key: 'axiom-secret',
	is_logdrain_custom_enabled: true,
	logdrain_custom_config: '[OUTPUT]\nName http',
	logdrain_custom_config_parser: '[PARSER]\nName json'
};

function event(values: Record<string, string> = {}, user = true) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid: 'server-1' },
		locals: { user: user ? { username: 'admin' } : null },
		url: new URL('http://localhost/servers/server-1/log-drains'),
		request: new Request('http://localhost/servers/server-1/log-drains', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => request.mockReset());

test('log drain loader projects safe fields and secret-presence flags', async () => {
	request.mockResolvedValueOnce(server).mockResolvedValueOnce(drains);
	const result = await loadServerLogDrains(event());
	expect(result.drains).toMatchObject({
		newRelicEnabled: true,
		newRelicBaseUri: 'https://log-api.newrelic.com',
		newRelicKeyConfigured: true,
		axiomEnabled: true,
		axiomDataset: 'production',
		axiomKeyConfigured: true,
		customEnabled: true,
		customConfigConfigured: true
	});
	expect(JSON.stringify(result)).not.toMatch(/newrelic-secret|axiom-secret|\[OUTPUT\]/);
});

test('log drain update keeps secrets by omission and sends one allowlisted PATCH', async () => {
	request
		.mockResolvedValueOnce(server)
		.mockResolvedValueOnce({ ...drains, secret: 'response-secret' });
	const result = await logDrainActions.update(
		event({
			confirmation: 'SAVE LOG DRAINS',
			is_logdrain_newrelic_enabled: 'true',
			logdrain_newrelic_base_uri: 'https://log-api.newrelic.com',
			is_logdrain_axiom_enabled: 'true',
			logdrain_axiom_dataset_name: 'production',
			is_logdrain_custom_enabled: 'false',
			logdrain_newrelic_license_key_mode: 'keep',
			logdrain_axiom_api_key_mode: 'replace',
			logdrain_axiom_api_key: 'new.axiom-key',
			logdrain_custom_config_mode: 'keep',
			logdrain_custom_config_parser_mode: 'clear',
			foreign: 'ignored'
		})
	);
	expect(request).toHaveBeenLastCalledWith('PATCH', '/servers/server-1/log-drains', {
		body: {
			is_logdrain_newrelic_enabled: true,
			logdrain_newrelic_base_uri: 'https://log-api.newrelic.com/',
			is_logdrain_axiom_enabled: true,
			logdrain_axiom_dataset_name: 'production',
			is_logdrain_custom_enabled: false,
			logdrain_axiom_api_key: 'new.axiom-key',
			logdrain_custom_config_parser: null
		}
	});
	expect(result).toEqual({ message: 'Log drain settings saved.' });
	expect(JSON.stringify(result)).not.toMatch(/new\.axiom-key|response-secret/);
});

test('log drain update validates confirmation and provider fields before API calls', async () => {
	const missingConfirmation = await logDrainActions.update(event());
	expect(missingConfirmation).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
	const missingDataset = await logDrainActions.update(
		event({
			confirmation: 'SAVE LOG DRAINS',
			is_logdrain_axiom_enabled: 'true',
			logdrain_newrelic_license_key_mode: 'keep',
			logdrain_axiom_api_key_mode: 'keep',
			logdrain_custom_config_mode: 'keep',
			logdrain_custom_config_parser_mode: 'keep'
		})
	);
	expect(missingDataset).toMatchObject({ status: 400 });
	expect(request).not.toHaveBeenCalled();
});

test('log drain secret reveal is explicit and no-store', async () => {
	const denied = await revealLogDrainSecrets(event({}, false));
	expect(denied.status).toBe(401);
	expect(request).not.toHaveBeenCalled();
	request.mockResolvedValueOnce(server).mockResolvedValueOnce(drains);
	const result = await revealLogDrainSecrets(event());
	expect(result.headers.get('cache-control')).toBe('no-store');
	expect(await result.json()).toEqual({
		newRelicLicenseKey: 'newrelic-secret',
		axiomApiKey: 'axiom-secret',
		customConfig: '[OUTPUT]\nName http',
		customParser: '[PARSER]\nName json'
	});
});
