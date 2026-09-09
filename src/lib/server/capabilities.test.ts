import { beforeEach, expect, test, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }) }));

import {
	CAPABILITY_VERSION_TTL_MS,
	capabilityUnavailable,
	requestCapability,
	resetCapabilityDetection
} from './capabilities';
import { CoolifyError } from './coolify-client';

beforeEach(() => {
	request.mockReset();
	resetCapabilityDetection();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
});

test('detects the Coolify version once during the bounded interval', async () => {
	request
		.mockResolvedValueOnce({ version: '4.0.0-beta.420' })
		.mockResolvedValueOnce([{ uuid: 'a' }])
		.mockResolvedValueOnce([{ uuid: 'b' }]);

	const first = await requestCapability('application-logs', () =>
		request('GET', '/applications/a/logs')
	);
	const second = await requestCapability('service-logs', () => request('GET', '/services/b/logs'));

	expect(first).toMatchObject({ available: true, version: '4.0.0-beta.420' });
	expect(second).toMatchObject({ available: true, version: '4.0.0-beta.420' });
	expect(request.mock.calls.filter((call) => call[1] === '/version')).toHaveLength(1);
});

test('remembers a capability-specific 404 as unavailable for the detected version', async () => {
	request
		.mockResolvedValueOnce('4.0.0-beta.420')
		.mockRejectedValueOnce(new CoolifyError('route details', 404));
	const operation = vi.fn(() => request('GET', '/services/a/logs'));

	const first = await requestCapability('service-logs', operation);
	const second = await requestCapability('service-logs', operation);

	expect(first).toEqual({
		available: false,
		version: '4.0.0-beta.420',
		reason: 'This capability is unavailable on the connected Coolify version.'
	});
	expect(second).toEqual(first);
	expect(operation).toHaveBeenCalledOnce();
});

test('does not let a resource-scoped 404 disable the same endpoint for another resource', async () => {
	request
		.mockResolvedValueOnce('4.0.0-beta.420')
		.mockRejectedValueOnce(new CoolifyError('missing resource', 404));
	await requestCapability('application-logs:missing', () =>
		request('GET', '/applications/missing/logs')
	);

	const operation = vi.fn().mockResolvedValue({ logs: 'ready' });
	const result = await requestCapability('application-logs:app-2', operation);

	expect(result).toMatchObject({ available: true, value: { logs: 'ready' } });
	expect(operation).toHaveBeenCalledOnce();
});

test('rechecks learned availability after the bounded version interval changes version', async () => {
	request
		.mockResolvedValueOnce('4.0.0-beta.420')
		.mockRejectedValueOnce(new CoolifyError('missing', 405));
	const operation = vi.fn().mockResolvedValue({ logs: 'ready' });
	await requestCapability('application-logs', () => request('GET', '/applications/a/logs'));

	vi.setSystemTime(Date.now() + CAPABILITY_VERSION_TTL_MS + 1);
	request.mockResolvedValueOnce('4.0.0-beta.421');
	const result = await requestCapability('application-logs', operation);

	expect(result).toEqual({
		available: true,
		version: '4.0.0-beta.421',
		value: { logs: 'ready' }
	});
	expect(operation).toHaveBeenCalledOnce();
});

test('does not flatten transport or server errors into capability unavailability', async () => {
	request.mockResolvedValueOnce('4.0.0-beta.420');
	const failure = new CoolifyError('upstream unavailable', 503);

	await expect(
		requestCapability('application-logs', async () => Promise.reject(failure))
	).rejects.toBe(failure);
	expect(capabilityUnavailable(failure)).toBe(false);
	expect(capabilityUnavailable(new CoolifyError('unsupported', 405))).toBe(true);
});
