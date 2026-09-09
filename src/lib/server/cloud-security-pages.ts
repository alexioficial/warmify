import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import {
	cloudInitScriptCollection,
	cloudInitScriptView,
	cloudProvider,
	cloudTokenCollection,
	cloudTokenView,
	type CloudInitScriptView,
	type CloudTokenView
} from '$lib/cloud-security-presenter';
import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { collectionSnapshotForPage, invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const UUID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const NAME_PATTERN = /^[\p{L}\p{M}\p{N}\s\-_.@/&()#,:+]+$/u;

function text(form: FormData, name: string) {
	return String(form.get(name) ?? '').trim();
}

function scriptText(form: FormData) {
	return String(form.get('script') ?? '').replace(/\r\n/g, '\n');
}

function validName(value: string) {
	return value.length >= 1 && value.length <= 255 && NAME_PATTERN.test(value);
}

function parseUuid(value: string | undefined, noun: string) {
	if (!value || !UUID_PATTERN.test(value)) error(404, `${noun} not found.`);
	return value;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function safeStatus(caught: unknown) {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

type TokenOperation = 'create' | 'update' | 'delete' | 'validate';

function safeTokenError(caught: unknown, operation: TokenOperation) {
	if (isHttpError(caught)) return caught.body.message;
	if (operation === 'validate')
		return 'Cloud token validation failed. Check the provider credential.';
	if (operation === 'create')
		return 'The cloud token could not be created. Check the provider credential.';
	if (
		operation === 'delete' &&
		caught instanceof CoolifyError &&
		[400, 409].includes(caught.status)
	)
		return 'Move or delete every server using this token before deleting it.';
	return `The cloud token could not be ${operation === 'update' ? 'updated' : 'deleted'}.`;
}

type ScriptOperation = 'create' | 'update' | 'delete';

function safeScriptError(caught: unknown, operation: ScriptOperation) {
	if (isHttpError(caught)) return caught.body.message;
	return `The cloud-init script could not be ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`;
}

async function readToken(uuidValue: string | undefined) {
	const uuid = parseUuid(uuidValue, 'Cloud token');
	const token = cloudTokenView(
		await getCoolifyClient().request('GET', `/cloud-tokens/${encodeURIComponent(uuid)}`)
	);
	if (!token || token.uuid !== uuid) error(404, 'Cloud token not found.');
	return token;
}

async function readScript(uuidValue: string | undefined) {
	const uuid = parseUuid(uuidValue, 'Cloud-init script');
	const script = cloudInitScriptView(
		await getCoolifyClient().request('GET', `/cloud-init-scripts/${encodeURIComponent(uuid)}`)
	);
	if (!script || script.uuid !== uuid) error(404, 'Cloud-init script not found.');
	return script;
}

export async function loadCloudTokenIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('cloud-tokens');
		return {
			tokens: cloudTokenCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return {
			tokens: [] as CloudTokenView[],
			sync: null,
			requestError: 'Cloud tokens could not be loaded.'
		};
	}
}

export async function loadCloudInitIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('cloud-init-scripts');
		return {
			scripts: cloudInitScriptCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return {
			scripts: [] as CloudInitScriptView[],
			sync: null,
			requestError: 'Cloud-init scripts could not be loaded.'
		};
	}
}

export async function loadCloudToken(uuidValue: string | undefined) {
	try {
		const token = await readToken(uuidValue);
		return {
			uuid: token.uuid,
			token,
			breadcrumbs: [
				{ label: 'Cloud tokens', href: '/security/cloud-tokens' },
				{ label: token.name, href: `/security/cloud-tokens/${token.uuid}/general` }
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Cloud token could not be loaded.'
		);
	}
}

export async function loadCloudInitScript(uuidValue: string | undefined) {
	try {
		const script = await readScript(uuidValue);
		return {
			uuid: script.uuid,
			script,
			breadcrumbs: [
				{ label: 'Cloud-init scripts', href: '/security/cloud-init-scripts' },
				{
					label: script.name,
					href: `/security/cloud-init-scripts/${script.uuid}/general`
				}
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Cloud-init script could not be loaded.'
		);
	}
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

export async function createCloudToken(event: RequestEvent) {
	const started = Date.now();
	let values: Record<string, string> = {};
	try {
		assertMutation(event);
		const form = await event.request.formData();
		const name = text(form, 'name');
		const provider = cloudProvider(form.get('provider'));
		const token = text(form, 'token');
		values = { name, provider: provider ?? '' };
		if (!validName(name)) error(400, 'Enter a valid token name no longer than 255 characters.');
		if (!provider) error(400, 'Select a supported cloud provider.');
		if (!token || token.length > 65_535) error(400, 'Enter a valid provider API token.');
		const response = asRecord(
			await getCoolifyClient().request('POST', '/cloud-tokens', {
				body: { provider, token, name }
			})
		);
		const uuid = firstText(response, ['uuid']);
		if (!UUID_PATTERN.test(uuid)) error(502, 'Coolify did not return the created token identity.');
		invalidateCollection('cloud-tokens');
		auditResult(event, 'create-cloud-token', 'success', started);
		redirect(303, `/security/cloud-tokens/${encodeURIComponent(uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, 'create-cloud-token', 'error', started);
		return fail(safeStatus(caught), { error: safeTokenError(caught, 'create'), values });
	}
}

export async function createCloudInitScript(event: RequestEvent) {
	const started = Date.now();
	let values: Record<string, string> = {};
	try {
		assertMutation(event);
		const form = await event.request.formData();
		const name = text(form, 'name');
		const script = scriptText(form);
		values = { name };
		if (!validName(name)) error(400, 'Enter a valid script name no longer than 255 characters.');
		if (!script.trim()) error(400, 'Enter a cloud-config YAML or shell script.');
		const response = asRecord(
			await getCoolifyClient().request('POST', '/cloud-init-scripts', {
				body: { name, script }
			})
		);
		const uuid = firstText(response, ['uuid']);
		if (!UUID_PATTERN.test(uuid)) error(502, 'Coolify did not return the created script identity.');
		invalidateCollection('cloud-init-scripts');
		auditResult(event, 'create-cloud-init-script', 'success', started);
		redirect(303, `/security/cloud-init-scripts/${encodeURIComponent(uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, 'create-cloud-init-script', 'error', started);
		return fail(safeStatus(caught), { error: safeScriptError(caught, 'create'), values });
	}
}

async function tokenMutation(
	event: RequestEvent,
	operation: 'update' | 'validate' | 'delete',
	callback: (token: CloudTokenView, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const token = await readToken(event.params.uuid);
		const result = await callback(token, await event.request.formData());
		auditResult(event, `${operation}-cloud-token`, 'success', started);
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `${operation}-cloud-token`, 'error', started);
		return fail(safeStatus(caught), { error: safeTokenError(caught, operation) });
	}
}

async function scriptMutation(
	event: RequestEvent,
	operation: 'update' | 'delete',
	callback: (script: CloudInitScriptView, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const script = await readScript(event.params.uuid);
		const result = await callback(script, await event.request.formData());
		auditResult(event, `${operation}-cloud-init-script`, 'success', started);
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `${operation}-cloud-init-script`, 'error', started);
		return fail(safeStatus(caught), { error: safeScriptError(caught, operation) });
	}
}

export const cloudTokenActions = {
	update: (event: RequestEvent) =>
		tokenMutation(event, 'update', async (token, form) => {
			const name = text(form, 'name');
			if (!validName(name)) error(400, 'Enter a valid token name no longer than 255 characters.');
			await getCoolifyClient().request('PATCH', `/cloud-tokens/${encodeURIComponent(token.uuid)}`, {
				body: { name }
			});
			invalidateCollection('cloud-tokens');
			return { message: 'Cloud token name saved.' };
		}),
	validate: (event: RequestEvent) =>
		tokenMutation(event, 'validate', async (token) => {
			const response = asRecord(
				await getCoolifyClient().request(
					'POST',
					`/cloud-tokens/${encodeURIComponent(token.uuid)}/validate`
				)
			);
			if (response?.valid !== true)
				error(422, 'Cloud token validation failed. Check the provider credential.');
			return { message: 'Cloud token is valid.' };
		}),
	delete: (event: RequestEvent) =>
		tokenMutation(event, 'delete', async (token, form) => {
			if (token.serversCount > 0)
				error(409, 'Move or delete every server using this token before deleting it.');
			const confirmation = text(form, 'confirmation');
			if (confirmation !== token.name && confirmation !== token.uuid)
				error(400, 'Type the token name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request('DELETE', `/cloud-tokens/${encodeURIComponent(token.uuid)}`);
			invalidateCollection('cloud-tokens');
			redirect(303, '/security/cloud-tokens');
		})
};

export const cloudInitActions = {
	update: (event: RequestEvent) =>
		scriptMutation(event, 'update', async (current, form) => {
			const name = text(form, 'name');
			const replacement = scriptText(form);
			if (!validName(name)) error(400, 'Enter a valid script name no longer than 255 characters.');
			await getCoolifyClient().request(
				'PATCH',
				`/cloud-init-scripts/${encodeURIComponent(current.uuid)}`,
				{ body: { name, ...(replacement.trim() ? { script: replacement } : {}) } }
			);
			invalidateCollection('cloud-init-scripts');
			return {
				message: replacement.trim()
					? 'Cloud-init script name and content saved.'
					: 'Cloud-init script name saved; the existing content was kept.'
			};
		}),
	delete: (event: RequestEvent) =>
		scriptMutation(event, 'delete', async (script, form) => {
			const confirmation = text(form, 'confirmation');
			if (confirmation !== script.name && confirmation !== script.uuid)
				error(400, 'Type the script name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request(
				'DELETE',
				`/cloud-init-scripts/${encodeURIComponent(script.uuid)}`
			);
			invalidateCollection('cloud-init-scripts');
			redirect(303, '/security/cloud-init-scripts');
		})
};
