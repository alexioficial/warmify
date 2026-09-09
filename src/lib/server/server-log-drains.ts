import { error, fail, isHttpError, json, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const formFlag = (form: FormData, name: string) => flag(form.getAll(name).at(-1));
const sensitiveFields = [
	'logdrain_newrelic_license_key',
	'logdrain_axiom_api_key',
	'logdrain_custom_config',
	'logdrain_custom_config_parser'
] as const;

function path(uuid: string) {
	if (!validId(uuid)) error(404, 'Server not found.');
	return `/servers/${encodeURIComponent(uuid)}/log-drains`;
}

export function serverLogDrainsView(value: unknown) {
	const row = asRecord(value) ?? {};
	return {
		newRelicEnabled: flag(row.is_logdrain_newrelic_enabled),
		newRelicBaseUri: firstText(row, ['logdrain_newrelic_base_uri']),
		newRelicKeyConfigured:
			typeof row.logdrain_newrelic_license_key === 'string' &&
			row.logdrain_newrelic_license_key.length > 0,
		axiomEnabled: flag(row.is_logdrain_axiom_enabled),
		axiomDataset: firstText(row, ['logdrain_axiom_dataset_name']),
		axiomKeyConfigured:
			typeof row.logdrain_axiom_api_key === 'string' && row.logdrain_axiom_api_key.length > 0,
		customEnabled: flag(row.is_logdrain_custom_enabled),
		customConfigConfigured:
			typeof row.logdrain_custom_config === 'string' && row.logdrain_custom_config.length > 0,
		customParserConfigured:
			typeof row.logdrain_custom_config_parser === 'string' &&
			row.logdrain_custom_config_parser.length > 0
	};
}

export async function loadServerLogDrains(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	try {
		const result = await getCoolifyClient().request('GET', path(uuid));
		return { drains: serverLogDrainsView(result), requestError: '' };
	} catch {
		return {
			drains: serverLogDrainsView({}),
			requestError: 'Log drain settings could not be loaded.'
		};
	}
}

function status(caught: unknown) {
	const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function safeUrl(value: string, required: boolean) {
	if (!value && !required) return null;
	try {
		const parsed = new URL(value);
		if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
			throw new Error('Unsafe URL.');
		return parsed.toString();
	} catch {
		error(400, 'Enter a valid HTTP or HTTPS New Relic base URI.');
	}
}

function sensitiveReplacement(
	form: FormData,
	body: Record<string, unknown>,
	field: (typeof sensitiveFields)[number],
	maximum: number,
	pattern?: RegExp
) {
	const mode = String(form.get(`${field}_mode`) ?? 'keep');
	const value = String(form.get(field) ?? '');
	if (!['keep', 'replace', 'clear'].includes(mode))
		error(400, 'Select a valid secret update mode.');
	if (mode === 'replace') {
		if (!value || value.length > maximum || (pattern && !pattern.test(value)))
			error(400, 'Enter a valid replacement value.');
		body[field] = value;
	}
	if (mode === 'clear') body[field] = null;
}

export const logDrainActions = {
	update: async (event: RequestEvent) => {
		const started = Date.now();
		try {
			assertMutation(event);
			const form = await event.request.formData();
			if (String(form.get('confirmation') ?? '') !== 'SAVE LOG DRAINS')
				error(400, 'Type SAVE LOG DRAINS exactly to confirm changes.');
			const newRelicEnabled = formFlag(form, 'is_logdrain_newrelic_enabled');
			const axiomEnabled = formFlag(form, 'is_logdrain_axiom_enabled');
			const customEnabled = formFlag(form, 'is_logdrain_custom_enabled');
			const newRelicBaseUri = String(form.get('logdrain_newrelic_base_uri') ?? '').trim();
			const axiomDataset = String(form.get('logdrain_axiom_dataset_name') ?? '').trim();
			if (axiomDataset && !/^[A-Za-z0-9_.-]+$/.test(axiomDataset))
				error(400, 'Enter a valid Axiom dataset name.');
			if (axiomEnabled && !axiomDataset) error(400, 'Axiom requires a dataset name.');
			const body: Record<string, unknown> = {
				is_logdrain_newrelic_enabled: newRelicEnabled,
				logdrain_newrelic_base_uri: safeUrl(newRelicBaseUri, newRelicEnabled),
				is_logdrain_axiom_enabled: axiomEnabled,
				logdrain_axiom_dataset_name: axiomDataset || null,
				is_logdrain_custom_enabled: customEnabled
			};
			const keyPattern = /^[A-Za-z0-9_.-]+$/;
			sensitiveReplacement(form, body, 'logdrain_newrelic_license_key', 500, keyPattern);
			sensitiveReplacement(form, body, 'logdrain_axiom_api_key', 500, keyPattern);
			sensitiveReplacement(form, body, 'logdrain_custom_config', 1_000_000);
			sensitiveReplacement(form, body, 'logdrain_custom_config_parser', 200_000);
			const uuid = event.params.uuid ?? '';
			await loadServer(uuid);
			await getCoolifyClient().request('PATCH', path(uuid), { body });
			audit({
				user: event.locals.user?.username,
				operation: 'update-server-log-drains',
				result: 'success',
				duration_ms: Date.now() - started
			});
			return { message: 'Log drain settings saved.' };
		} catch (caught) {
			audit({
				user: event.locals.user?.username,
				operation: 'update-server-log-drains',
				result: 'error',
				duration_ms: Date.now() - started
			});
			return fail(status(caught), {
				error: 'Log drain settings could not be saved. Check the values and try again.'
			});
		}
	}
};

export async function revealLogDrainSecrets(event: RequestEvent) {
	const headers = { 'cache-control': 'no-store' };
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		await loadServer(uuid);
		const row = asRecord(await getCoolifyClient().request('GET', path(uuid)));
		if (!row || !sensitiveFields.some((field) => Object.hasOwn(row, field)))
			error(403, 'Sensitive log drain settings unavailable.');
		audit({
			user: event.locals.user?.username,
			operation: 'reveal-server-log-drain-secrets',
			result: 'secret-revealed'
		});
		return json(
			{
				newRelicLicenseKey:
					typeof row.logdrain_newrelic_license_key === 'string'
						? row.logdrain_newrelic_license_key
						: null,
				axiomApiKey:
					typeof row.logdrain_axiom_api_key === 'string' ? row.logdrain_axiom_api_key : null,
				customConfig:
					typeof row.logdrain_custom_config === 'string' ? row.logdrain_custom_config : null,
				customParser:
					typeof row.logdrain_custom_config_parser === 'string'
						? row.logdrain_custom_config_parser
						: null
			},
			{ headers }
		);
	} catch (caught) {
		const code = status(caught);
		return json(
			{
				message:
					code === 401
						? 'Authentication required.'
						: code === 403
							? 'Sensitive log drain settings unavailable. Sensitive-read permission is required.'
							: code === 404
								? 'Server not found.'
								: 'Sensitive log drain settings could not be revealed.'
			},
			{ status: code, headers }
		);
	}
}
