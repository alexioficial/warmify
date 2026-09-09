import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

export interface DestinationView {
	uuid: string;
	name: string;
	network: string;
	type: string;
	serverUuid: string;
	createdAt: string;
	updatedAt: string;
}

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);

export function destinationView(value: unknown): DestinationView | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validId(uuid)) return undefined;
	return {
		uuid,
		name: firstText(row, ['name']) || 'Destination',
		network: firstText(row, ['network']),
		type: firstText(row, ['type']) || 'standalone',
		serverUuid: firstText(row, ['server_uuid']) || firstText(asRecord(row?.server), ['uuid']),
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

async function readDestination(uuid: string): Promise<DestinationView> {
	if (!validId(uuid)) error(404, 'Destination not found.');
	const destination = destinationView(
		await getCoolifyClient().request('GET', `/destinations/${encodeURIComponent(uuid)}`)
	);
	if (!destination || destination.uuid !== uuid) error(404, 'Destination not found.');
	return destination;
}

export async function loadDestination(uuid: string) {
	try {
		const destination = await readDestination(uuid);
		return {
			uuid,
			destination,
			breadcrumbs: [
				{ label: 'Destinations', href: '/destinations' },
				{
					label: destination.name,
					href: `/destinations/${encodeURIComponent(uuid)}/general`
				}
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Destination could not be loaded.'
		);
	}
}

export async function loadServerDestinations(uuid: string) {
	const parent = await loadServer(uuid);
	try {
		const destinations = normalizeRecords(
			await getCoolifyClient().request('GET', `/servers/${encodeURIComponent(uuid)}/destinations`)
		)
			.map(destinationView)
			.filter((row): row is DestinationView => row !== undefined && row.serverUuid === uuid);
		return { ...parent, destinations, requestError: '' };
	} catch {
		return {
			...parent,
			destinations: [] as DestinationView[],
			requestError: 'Server destinations could not be loaded.'
		};
	}
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function safeStatus(caught: unknown): number {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

function safeDestinationError(caught: unknown, operation: 'create' | 'update' | 'delete') {
	if (caught instanceof CoolifyError && caught.status === 409) {
		return operation === 'delete'
			? 'Detach every resource from this destination before deleting it.'
			: 'A destination using this network already exists on the server.';
	}
	if (isHttpError(caught)) return caught.body.message;
	return `The destination could not be ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`;
}

function auditResult(
	event: RequestEvent,
	operation: string,
	result: 'success' | 'error',
	started: number
) {
	audit({
		user: event.locals.user?.username,
		operation,
		result,
		duration_ms: Date.now() - started
	});
}

export async function createDestinationAction(event: RequestEvent) {
	const started = Date.now();
	let values = { name: '', network: '' };
	try {
		assertMutation(event);
		const serverUuid = event.params.uuid ?? '';
		if (!validId(serverUuid)) error(404, 'Server not found.');
		const form = await event.request.formData();
		values = {
			name: String(form.get('name') ?? '').trim(),
			network: String(form.get('network') ?? '').trim()
		};
		if (values.name.length > 255) error(400, 'Destination name must be 255 characters or fewer.');
		if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(values.network))
			error(400, 'Use letters, numbers, dots, underscores, or hyphens for the network name.');
		await loadServer(serverUuid);
		const result = destinationView(
			await getCoolifyClient().request(
				'POST',
				`/servers/${encodeURIComponent(serverUuid)}/destinations`,
				{ body: { ...(values.name ? { name: values.name } : {}), network: values.network } }
			)
		);
		invalidateCollection('destinations');
		invalidateCollection('servers');
		auditResult(event, 'create-server-destination', 'success', started);
		if (!result) return { message: 'Destination created.', values: { name: '', network: '' } };
		redirect(303, `/destinations/${encodeURIComponent(result.uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, 'create-server-destination', 'error', started);
		return fail(safeStatus(caught), {
			error: safeDestinationError(caught, 'create'),
			values
		});
	}
}

async function destinationMutation(
	event: RequestEvent,
	operation: 'update' | 'delete',
	callback: (destination: DestinationView, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		const form = await event.request.formData();
		const destination = await readDestination(uuid);
		const result = await callback(destination, form);
		auditResult(event, `${operation}-destination`, 'success', started);
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `${operation}-destination`, 'error', started);
		return fail(safeStatus(caught), { error: safeDestinationError(caught, operation) });
	}
}

export const destinationActions = {
	update: (event: RequestEvent) =>
		destinationMutation(event, 'update', async (destination, form) => {
			const name = String(form.get('name') ?? '').trim();
			if (!name || name.length > 255) error(400, 'Enter a valid destination name.');
			await getCoolifyClient().request(
				'PATCH',
				`/destinations/${encodeURIComponent(destination.uuid)}`,
				{ body: { name } }
			);
			invalidateCollection('destinations');
			invalidateCollection('servers');
			return { message: 'Destination name saved.' };
		}),
	delete: (event: RequestEvent) =>
		destinationMutation(event, 'delete', async (destination, form) => {
			if (destination.network === 'coolify')
				error(400, 'The default Coolify destination cannot be deleted.');
			const confirmation = String(form.get('confirmation') ?? '');
			if (confirmation !== destination.name && confirmation !== destination.uuid)
				error(400, 'Type the destination name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request(
				'DELETE',
				`/destinations/${encodeURIComponent(destination.uuid)}`
			);
			invalidateCollection('destinations');
			invalidateCollection('servers');
			redirect(303, '/destinations');
		})
};
