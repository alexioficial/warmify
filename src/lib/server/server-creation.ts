import { isIP } from 'node:net';
import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

export interface PrivateKeyChoice {
	uuid: string;
	name: string;
	description: string;
}

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const checked = (value: unknown) => value === 'true' || value === '1' || value === true;

export function privateKeyView(value: unknown): PrivateKeyChoice | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validId(uuid)) return undefined;
	return {
		uuid,
		name: firstText(row, ['name']) || 'Private key',
		description: firstText(row, ['description'])
	};
}

async function readPrivateKeys(): Promise<PrivateKeyChoice[]> {
	return normalizeRecords(await getCoolifyClient().request('GET', '/security/keys'))
		.map(privateKeyView)
		.filter((key): key is PrivateKeyChoice => key !== undefined);
}

export async function loadServerCreation(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return { keys: await readPrivateKeys(), requestError: '' };
	} catch {
		return {
			keys: [] as PrivateKeyChoice[],
			requestError:
				'Private keys could not be loaded. Create or verify a key before adding a server.'
		};
	}
}

function validHost(value: string): boolean {
	if (isIP(value)) return true;
	if (!value || value.length > 253 || value.endsWith('.')) return false;
	return value.split('.').every((part) => {
		return (
			part.length >= 1 &&
			part.length <= 63 &&
			/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(part)
		);
	});
}

function safeStatus(caught: unknown): number {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

function safeCreationError(caught: unknown): string {
	if (caught instanceof CoolifyError && caught.status === 400)
		return 'A server with this address may already exist.';
	if (caught instanceof CoolifyError && caught.status === 404)
		return 'The selected private key is no longer available.';
	if (isHttpError(caught)) return caught.body.message;
	return 'The server could not be created. Verify the connection details and try again.';
}

export async function createServerAction(event: RequestEvent) {
	const started = Date.now();
	let values = {
		name: '',
		description: '',
		ip: '',
		port: 22,
		user: 'root',
		privateKeyUuid: '',
		proxyType: 'traefik',
		isBuildServer: false,
		instantValidate: false
	};
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		const form = await event.request.formData();
		values = {
			name: String(form.get('name') ?? '').trim(),
			description: String(form.get('description') ?? '').trim(),
			ip: String(form.get('ip') ?? '').trim(),
			port: Number(form.get('port')),
			user: String(form.get('user') ?? '').trim(),
			privateKeyUuid: String(form.get('private_key_uuid') ?? '').trim(),
			proxyType: String(form.get('proxy_type') ?? 'traefik')
				.trim()
				.toLowerCase(),
			isBuildServer: checked(form.getAll('is_build_server').at(-1)),
			instantValidate: checked(form.getAll('instant_validate').at(-1))
		};
		if (values.name.length > 255) error(400, 'Server name must be 255 characters or fewer.');
		if (!validHost(values.ip)) error(400, 'Enter a valid IP address or hostname.');
		if (!Number.isSafeInteger(values.port) || values.port < 1 || values.port > 65535)
			error(400, 'Enter a valid SSH port.');
		if (!/^[A-Za-z0-9._-]+$/.test(values.user)) error(400, 'Enter a valid SSH user.');
		if (!validId(values.privateKeyUuid)) error(400, 'Select a private key.');
		if (!['traefik', 'caddy', 'none'].includes(values.proxyType))
			error(400, 'Select a supported proxy type.');

		const keys = await readPrivateKeys();
		if (!keys.some((key) => key.uuid === values.privateKeyUuid))
			error(400, 'The selected private key is not available to this team.');

		const body = {
			...(values.name ? { name: values.name } : {}),
			...(values.description ? { description: values.description } : {}),
			ip: values.ip,
			port: values.port,
			user: values.user,
			private_key_uuid: values.privateKeyUuid,
			is_build_server: values.isBuildServer,
			instant_validate: values.instantValidate,
			proxy_type: values.proxyType
		};
		const result = asRecord(await getCoolifyClient().request('POST', '/servers', { body }));
		const uuid = firstText(result, ['uuid']);
		invalidateCollection('servers');
		audit({
			user: event.locals.user.username,
			operation: 'create-server',
			result: 'success',
			duration_ms: Date.now() - started
		});
		if (!validId(uuid))
			return {
				message: values.instantValidate
					? 'Server created. Validation was queued.'
					: 'Server created.',
				values: { ...values, privateKeyUuid: '' }
			};
		redirect(303, `/servers/${encodeURIComponent(uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		audit({
			user: event.locals.user?.username,
			operation: 'create-server',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(safeStatus(caught), {
			error: safeCreationError(caught),
			values
		});
	}
}
