import {
	error,
	fail,
	isHttpError,
	isRedirect,
	json,
	redirect,
	type RequestEvent
} from '@sveltejs/kit';

import {
	privateKeyCollection,
	privateKeyView,
	teamCollection,
	teamMemberCollection,
	teamView,
	type PrivateKeyView,
	type TeamView
} from '$lib/administration-presenter';
import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { collectionSnapshotForPage, invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const UUID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const TEAM_ID_PATTERN = /^[0-9]+$/;

function text(form: FormData, name: string) {
	return String(form.get(name) ?? '').trim();
}

function privateMaterial(form: FormData, name: string) {
	return String(form.get(name) ?? '')
		.replace(/\r\n/g, '\n')
		.trim();
}

function assertMutation(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
	return user;
}

function keyUuid(value: string | undefined) {
	if (!value || !UUID_PATTERN.test(value)) error(404, 'Private key not found.');
	return value;
}

function teamId(value: string | undefined) {
	if (!value || !TEAM_ID_PATTERN.test(value)) error(404, 'Team not found.');
	return value;
}

function safeStatus(caught: unknown) {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

type KeyOperation = 'create' | 'update' | 'delete' | 'reveal';

function safeKeyError(caught: unknown, operation: KeyOperation) {
	if (isHttpError(caught)) return caught.body.message;
	if (operation === 'delete' && caught instanceof CoolifyError && caught.status === 422)
		return 'This private key is still used by a server, application, or Git integration.';
	if (operation === 'update' && caught instanceof CoolifyError && caught.status === 403)
		return 'Enter a replacement key or use an API token with sensitive-read permission to keep the current key.';
	if (operation === 'reveal')
		return 'Private key material is unavailable. Sensitive-read permission is required.';
	return `The private key could not be ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`;
}

async function readPrivateKeyRecord(uuidValue: string | undefined) {
	const uuid = keyUuid(uuidValue);
	const record = asRecord(
		await getCoolifyClient().request('GET', `/security/keys/${encodeURIComponent(uuid)}`)
	);
	const key = privateKeyView(record);
	if (!record || !key || key.uuid !== uuid) error(404, 'Private key not found.');
	return { record, key };
}

function auditResult(
	event: RequestEvent,
	operation: string,
	result: 'success' | 'error' | 'secret-revealed',
	started?: number
) {
	audit({
		user: event.locals.user?.username,
		operation,
		result,
		...(started === undefined ? {} : { duration_ms: Date.now() - started })
	});
}

export async function loadPrivateKeyIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('security');
		return {
			keys: privateKeyCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return {
			keys: [] as PrivateKeyView[],
			sync: null,
			requestError: 'Private keys could not be loaded.'
		};
	}
}

export async function loadPrivateKey(uuidValue: string | undefined) {
	try {
		const { key } = await readPrivateKeyRecord(uuidValue);
		return {
			uuid: key.uuid,
			key,
			breadcrumbs: [
				{ label: 'Private keys', href: '/security/keys' },
				{ label: key.name, href: `/security/keys/${encodeURIComponent(key.uuid)}` }
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Private key could not be loaded.'
		);
	}
}

export async function createPrivateKey(event: RequestEvent) {
	const started = Date.now();
	let values = { name: '', description: '' };
	try {
		assertMutation(event);
		const form = await event.request.formData();
		const name = text(form, 'name');
		const description = text(form, 'description');
		const privateKey = privateMaterial(form, 'private_key');
		values = { name, description };
		if (name.length > 255) error(400, 'Use a name no longer than 255 characters.');
		if (description.length > 255) error(400, 'Use a description no longer than 255 characters.');
		if (!privateKey || privateKey.length > 1_000_000) error(400, 'Enter a valid private key.');
		const response = asRecord(
			await getCoolifyClient().request('POST', '/security/keys', {
				body: {
					...(name ? { name } : {}),
					...(description ? { description } : {}),
					private_key: privateKey
				}
			})
		);
		const uuid = firstText(response, ['uuid']);
		if (!UUID_PATTERN.test(uuid)) error(502, 'Coolify did not return the created key identity.');
		invalidateCollection('security');
		auditResult(event, 'create-private-key', 'success', started);
		redirect(303, `/security/keys/${encodeURIComponent(uuid)}`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, 'create-private-key', 'error', started);
		return fail(safeStatus(caught), { error: safeKeyError(caught, 'create'), values });
	}
}

export const privateKeyActions = {
	update: async (event: RequestEvent) => {
		const started = Date.now();
		let values = { name: '', description: '' };
		try {
			assertMutation(event);
			const form = await event.request.formData();
			const name = text(form, 'name');
			const description = text(form, 'description');
			const replacement = privateMaterial(form, 'replacement_private_key');
			values = { name, description };
			if (!name || name.length > 255) error(400, 'Enter a key name no longer than 255 characters.');
			if (description.length > 255) error(400, 'Use a description no longer than 255 characters.');
			if (replacement.length > 1_000_000) error(400, 'The replacement private key is too large.');
			const { record, key } = await readPrivateKeyRecord(event.params.uuid);
			const current = typeof record.private_key === 'string' ? record.private_key.trim() : '';
			const material = replacement || current;
			if (!material)
				error(
					403,
					'Enter a replacement key or use an API token with sensitive-read permission to keep the current key.'
				);
			await getCoolifyClient().request('PATCH', `/security/keys/${encodeURIComponent(key.uuid)}`, {
				body: { name, description, private_key: material }
			});
			invalidateCollection('security');
			auditResult(event, 'update-private-key', 'success', started);
			return {
				message: replacement
					? 'Private key metadata and key material updated.'
					: 'Private key metadata updated; existing key material kept.'
			};
		} catch (caught) {
			auditResult(event, 'update-private-key', 'error', started);
			return fail(safeStatus(caught), {
				error: safeKeyError(caught, 'update'),
				values
			});
		}
	},
	delete: async (event: RequestEvent) => {
		const started = Date.now();
		try {
			assertMutation(event);
			const form = await event.request.formData();
			const { key } = await readPrivateKeyRecord(event.params.uuid);
			const confirmation = text(form, 'confirmation');
			if (confirmation !== key.name && confirmation !== key.uuid)
				error(400, 'Type the key name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request('DELETE', `/security/keys/${encodeURIComponent(key.uuid)}`);
			invalidateCollection('security');
			auditResult(event, 'delete-private-key', 'success', started);
			redirect(303, '/security/keys');
		} catch (caught) {
			if (isRedirect(caught)) throw caught;
			auditResult(event, 'delete-private-key', 'error', started);
			return fail(safeStatus(caught), { error: safeKeyError(caught, 'delete') });
		}
	}
};

export async function revealPrivateKey(event: RequestEvent) {
	const headers = { 'cache-control': 'no-store' };
	try {
		assertMutation(event);
		const { record } = await readPrivateKeyRecord(event.params.uuid);
		if (typeof record.private_key !== 'string' || !record.private_key)
			error(403, 'Private key material is unavailable.');
		auditResult(event, 'reveal-private-key', 'secret-revealed');
		return json({ privateKey: record.private_key }, { headers });
	} catch (caught) {
		const status = safeStatus(caught);
		return json({ message: safeKeyError(caught, 'reveal') }, { status, headers });
	}
}

export async function loadTeamIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('teams');
		return {
			teams: teamCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return { teams: [] as TeamView[], sync: null, requestError: 'Teams could not be loaded.' };
	}
}

async function readTeam(idValue: string | undefined) {
	const id = teamId(idValue);
	const team = teamView(
		await getCoolifyClient().request('GET', `/teams/${encodeURIComponent(id)}`)
	);
	if (!team || team.id !== id) error(404, 'Team not found.');
	return team;
}

export async function loadTeamDetail(
	idValue: string | undefined,
	setHeaders?: (headers: Record<string, string>) => void
) {
	setHeaders?.({ 'cache-control': 'no-store' });
	try {
		const team = await readTeam(idValue);
		const members = teamMemberCollection(
			await getCoolifyClient().request('GET', `/teams/${encodeURIComponent(team.id)}/members`)
		);
		return {
			team,
			members,
			breadcrumbs: [
				{ label: 'Teams', href: '/teams' },
				{ label: team.name, href: `/teams/${encodeURIComponent(team.id)}` }
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Team could not be loaded.'
		);
	}
}
