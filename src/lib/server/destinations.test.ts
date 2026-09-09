import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';

const request = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: invalidate }));

import {
	createDestinationAction,
	destinationActions,
	destinationView,
	loadDestination,
	loadServerDestinations
} from './destinations';

const rawServer = {
	uuid: 'server-1',
	name: 'Primary',
	ip: '192.0.2.10',
	settings: { is_reachable: true, is_usable: true }
};
const rawDestination = {
	id: 99,
	uuid: 'destination-1',
	name: 'Primary network',
	network: 'edge-network',
	type: 'standalone',
	server_uuid: 'server-1',
	created_at: '2026-08-30T12:00:00Z',
	updated_at: '2026-08-30T12:00:01Z',
	secret: 'destination-secret'
};

function event(
	values: Record<string, string>,
	path = '/destinations/destination-1/general',
	params: Record<string, string> = { uuid: 'destination-1' }
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params,
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

test('destination presenter exposes only the documented fields', () => {
	const result = destinationView(rawDestination);
	expect(result).toEqual({
		uuid: 'destination-1',
		name: 'Primary network',
		network: 'edge-network',
		type: 'standalone',
		serverUuid: 'server-1',
		createdAt: '2026-08-30T12:00:00Z',
		updatedAt: '2026-08-30T12:00:01Z'
	});
	expect(JSON.stringify(result)).not.toMatch(/destination-secret|"id":99/);
});

test('server destinations verify their parent and serialize projected rows only', async () => {
	request.mockResolvedValueOnce(rawServer).mockResolvedValueOnce([rawDestination]);
	const result = await loadServerDestinations('server-1');
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['GET', '/servers/server-1/destinations']
	]);
	expect(result.destinations).toEqual([destinationView(rawDestination)]);
	expect(JSON.stringify(result)).not.toContain('destination-secret');
});

test('destination loader verifies route identity', async () => {
	request.mockResolvedValue(rawDestination);
	const result = await loadDestination('destination-1');
	expect(result.destination).toEqual(destinationView(rawDestination));
	expect(result.breadcrumbs).toEqual([
		{ label: 'Destinations', href: '/destinations' },
		{ label: 'Primary network', href: '/destinations/destination-1/general' }
	]);

	request.mockReset();
	request.mockResolvedValue({ ...rawDestination, uuid: 'another-destination' });
	await expect(loadDestination('destination-1')).rejects.toMatchObject({ status: 404 });
});

test('server destination creation sends only name and network', async () => {
	request
		.mockResolvedValueOnce(rawServer)
		.mockResolvedValueOnce({ ...rawDestination, uuid: 'destination-new' });
	await expect(
		createDestinationAction(
			event(
				{ name: 'Edge', network: 'edge_network', type: 'swarm', server_uuid: 'forged' },
				'/servers/server-1/destinations',
				{ uuid: 'server-1' }
			)
		)
	).rejects.toMatchObject({ status: 303, location: '/destinations/destination-new/general' });
	expect(request.mock.calls).toEqual([
		['GET', '/servers/server-1'],
		['POST', '/servers/server-1/destinations', { body: { name: 'Edge', network: 'edge_network' } }]
	]);
});

test('destination update changes only the name', async () => {
	request.mockResolvedValueOnce(rawDestination).mockResolvedValueOnce(rawDestination);
	const result = await destinationActions.update(
		event({ name: 'Renamed', network: 'forged-network', server_uuid: 'server-2' })
	);
	expect(result).toMatchObject({ message: 'Destination name saved.' });
	expect(request.mock.calls).toEqual([
		['GET', '/destinations/destination-1'],
		['PATCH', '/destinations/destination-1', { body: { name: 'Renamed' } }]
	]);
});

test('default coolify network is protected and attached destinations get a safe error', async () => {
	request.mockResolvedValueOnce({ ...rawDestination, network: 'coolify' });
	const protectedResult = await destinationActions.delete(
		event({ confirmation: 'Primary network' }, '/destinations/destination-1/danger')
	);
	expect(protectedResult).toMatchObject({ status: 400 });
	expect(request.mock.calls.some(([method]) => method === 'DELETE')).toBe(false);

	request.mockReset();
	request
		.mockResolvedValueOnce(rawDestination)
		.mockRejectedValueOnce(new CoolifyError('fixture attached secret', 409));
	const attachedResult = await destinationActions.delete(
		event({ confirmation: 'destination-1' }, '/destinations/destination-1/danger')
	);
	expect(attachedResult).toMatchObject({
		status: 409,
		data: { error: 'Detach every resource from this destination before deleting it.' }
	});
	expect(JSON.stringify(attachedResult)).not.toContain('fixture attached secret');
});
