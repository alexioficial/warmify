import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const integer = (value: unknown) => {
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : undefined;
};

export function serverView(value: unknown) {
	const row = asRecord(value) ?? {};
	const settings = asRecord(row.settings) ?? {};
	return {
		uuid: firstText(row, ['uuid']),
		name: firstText(row, ['name']) || 'Server',
		description: firstText(row, ['description']),
		ip: firstText(row, ['ip']),
		port: integer(row.port),
		user: firstText(row, ['user']),
		proxyType: firstText(row, ['proxy_type']) || firstText(asRecord(row.proxy), ['type']),
		isReachable: flag(settings.is_reachable ?? row.is_reachable),
		isUsable: flag(settings.is_usable ?? row.is_usable),
		isCoolifyHost: flag(row.is_coolify_host),
		isBuildServer: flag(settings.is_build_server),
		isTerminalEnabled: flag(settings.is_terminal_enabled),
		concurrentBuilds: integer(settings.concurrent_builds),
		dynamicTimeout: integer(settings.dynamic_timeout),
		deploymentQueueLimit: integer(settings.deployment_queue_limit),
		diskUsageThreshold: integer(settings.server_disk_usage_notification_threshold),
		diskUsageFrequency: firstText(settings, ['server_disk_usage_check_frequency']),
		connectionTimeout: integer(settings.connection_timeout)
	};
}

async function readServer(uuid: string) {
	if (!validId(uuid)) error(404, 'Server not found.');
	const server = serverView(
		await getCoolifyClient().request('GET', `/servers/${encodeURIComponent(uuid)}`)
	);
	if (server.uuid !== uuid) error(404, 'Server not found.');
	return server;
}

export async function loadServer(uuid: string) {
	try {
		const server = await readServer(uuid);
		return {
			uuid,
			server,
			breadcrumbs: [
				{ label: 'Servers', href: '/servers' },
				{ label: server.name, href: `/servers/${encodeURIComponent(uuid)}/general` }
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Server could not be loaded.'
		);
	}
}

export interface ServerResourceRow {
	uuid: string;
	name: string;
	type: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	href?:
		| `/applications/${string}/general`
		| `/services/${string}/general`
		| `/databases/${string}/general`;
}

function resourceHref(type: string, uuid: string): ServerResourceRow['href'] {
	const normalized = type.toLowerCase();
	if (normalized.includes('application'))
		return `/applications/${encodeURIComponent(uuid)}/general`;
	if (normalized.includes('service')) return `/services/${encodeURIComponent(uuid)}/general`;
	if (
		[
			'database',
			'postgres',
			'mysql',
			'mariadb',
			'mongo',
			'redis',
			'keydb',
			'dragonfly',
			'clickhouse'
		].some((kind) => normalized.includes(kind))
	)
		return `/databases/${encodeURIComponent(uuid)}/general`;
	return undefined;
}

export async function loadServerResources(uuid: string) {
	if (!validId(uuid)) error(404, 'Server not found.');
	try {
		const resources = normalizeRecords(
			await getCoolifyClient().request('GET', `/servers/${encodeURIComponent(uuid)}/resources`)
		)
			.map((row): ServerResourceRow | undefined => {
				const resourceUuid = firstText(row, ['uuid']);
				if (!validId(resourceUuid)) return undefined;
				const type = firstText(row, ['type']) || 'Unknown';
				return {
					uuid: resourceUuid,
					name: firstText(row, ['name']) || resourceUuid,
					type,
					status: firstText(row, ['status']) || 'unknown',
					createdAt: firstText(row, ['created_at']),
					updatedAt: firstText(row, ['updated_at']),
					href: resourceHref(type, resourceUuid)
				};
			})
			.filter((row): row is ServerResourceRow => row !== undefined);
		return { resources, requestError: '' };
	} catch {
		return {
			resources: [] as ServerResourceRow[],
			requestError: 'Server resources could not be loaded.'
		};
	}
}

export async function loadServerDomains(uuid: string) {
	if (!validId(uuid)) error(404, 'Server not found.');
	try {
		const domains = normalizeRecords(
			await getCoolifyClient().request('GET', `/servers/${encodeURIComponent(uuid)}/domains`)
		)
			.map((row) => ({
				ip: firstText(row, ['ip']),
				domains: Array.isArray(row.domains)
					? row.domains.filter(
							(domain): domain is string => typeof domain === 'string' && domain.trim() !== ''
						)
					: []
			}))
			.filter((row) => row.ip || row.domains.length);
		return { domains, requestError: '' };
	} catch {
		return {
			domains: [] as Array<{ ip: string; domains: string[] }>,
			requestError: 'Server domains could not be loaded.'
		};
	}
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function requiredInteger(form: FormData, name: string, minimum: number, maximum?: number) {
	const value = Number(form.get(name));
	if (!Number.isSafeInteger(value) || value < minimum || (maximum !== undefined && value > maximum))
		error(400, 'Enter valid advanced server settings.');
	return value;
}

function formFlag(form: FormData, name: string) {
	return flag(form.getAll(name).at(-1));
}

function failure(caught: unknown, message: string) {
	const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return fail(candidate >= 400 && candidate <= 599 ? candidate : 500, { error: message });
}

async function mutate(
	event: RequestEvent,
	operation: string,
	callback: (uuid: string, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		if (!validId(uuid)) error(404, 'Server not found.');
		const form = await event.request.formData();
		const result = await callback(uuid, form);
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return failure(
			caught,
			'The server operation could not be completed. Check its current state and try again.'
		);
	}
}

export const serverActions = {
	updateGeneral: (event: RequestEvent) =>
		mutate(event, 'update-server-general', async (uuid, form) => {
			const values = {
				name: String(form.get('name') ?? '').trim(),
				description: String(form.get('description') ?? '').trim(),
				ip: String(form.get('ip') ?? '').trim(),
				port: Number(form.get('port')),
				user: String(form.get('user') ?? '').trim()
			};
			if (!values.name || values.name.length > 255) error(400, 'Enter a valid server name.');
			if (!values.ip || values.ip.length > 255) error(400, 'Enter a valid server address.');
			if (!Number.isInteger(values.port) || values.port < 1 || values.port > 65535)
				error(400, 'Enter a valid SSH port.');
			if (!/^[A-Za-z_][A-Za-z0-9._-]*\$?$/.test(values.user)) error(400, 'Enter a valid SSH user.');
			await readServer(uuid);
			await getCoolifyClient().request('PATCH', `/servers/${encodeURIComponent(uuid)}`, {
				body: { ...values, description: values.description || null }
			});
			invalidateCollection('servers');
			return { message: 'Server settings saved.' };
		}),
	validate: (event: RequestEvent) =>
		mutate(event, 'validate-server', async (uuid, form) => {
			if (form.get('confirmation') !== 'confirm') error(400, 'Confirm server validation.');
			const install = flag(form.get('install'));
			await readServer(uuid);
			await getCoolifyClient().request('POST', `/servers/${encodeURIComponent(uuid)}/validate`, {
				body: { install }
			});
			invalidateCollection('servers');
			return {
				message: install
					? 'Server validation and installation started.'
					: 'Server validation started.'
			};
		}),
	updateAdvanced: (event: RequestEvent) =>
		mutate(event, 'update-server-advanced', async (uuid, form) => {
			const frequency = String(form.get('server_disk_usage_check_frequency') ?? '').trim();
			if (!frequency || frequency.length > 255)
				error(400, 'Enter a valid disk usage check frequency.');
			const body = {
				concurrent_builds: requiredInteger(form, 'concurrent_builds', 1),
				dynamic_timeout: requiredInteger(form, 'dynamic_timeout', 1),
				deployment_queue_limit: requiredInteger(form, 'deployment_queue_limit', 1),
				server_disk_usage_notification_threshold: requiredInteger(
					form,
					'server_disk_usage_notification_threshold',
					1,
					100
				),
				server_disk_usage_check_frequency: frequency,
				connection_timeout: requiredInteger(form, 'connection_timeout', 1, 300),
				is_build_server: formFlag(form, 'is_build_server'),
				is_terminal_enabled: formFlag(form, 'is_terminal_enabled')
			};
			await readServer(uuid);
			await getCoolifyClient().request('PATCH', `/servers/${encodeURIComponent(uuid)}`, {
				body
			});
			invalidateCollection('servers');
			return { message: 'Advanced server settings saved.' };
		}),
	delete: (event: RequestEvent) =>
		mutate(event, 'delete-server', async (uuid, form) => {
			const server = await readServer(uuid);
			if (server.isCoolifyHost) error(400, 'The local Coolify host cannot be deleted.');
			const confirmation = String(form.get('confirmation') ?? '');
			if (confirmation !== server.name && confirmation !== server.uuid)
				error(400, 'Type the server name or UUID exactly to confirm deletion.');
			const force = formFlag(form, 'force');
			if (force && String(form.get('force_confirmation') ?? '') !== 'DELETE ALL RESOURCES')
				error(400, 'Type DELETE ALL RESOURCES exactly to force deletion.');
			await getCoolifyClient().request(
				'DELETE',
				`/servers/${encodeURIComponent(uuid)}${force ? '?force=true' : ''}`
			);
			invalidateCollection('servers');
			redirect(303, '/servers');
		})
};
