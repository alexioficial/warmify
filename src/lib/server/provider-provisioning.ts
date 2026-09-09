import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import {
	cloudInitScriptCollection,
	cloudProvider,
	cloudProviderLabel,
	cloudTokenCollection,
	type CloudInitScriptView,
	type CloudProvider,
	type CloudTokenView
} from '$lib/cloud-security-presenter';
import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';
import { privateKeyView, type PrivateKeyChoice } from './server-creation';

export interface ProviderOption {
	value: string;
	label: string;
	description: string;
}

export interface ProviderOptions {
	regions: ProviderOption[];
	sizes: ProviderOption[];
	images: ProviderOption[];
	sshKeys: ProviderOption[];
	firewalls: ProviderOption[];
	networks: ProviderOption[];
}

interface CreationContext {
	tokens: CloudTokenView[];
	keys: PrivateKeyChoice[];
	scripts: CloudInitScriptView[];
}

interface ProvisioningValues {
	name: string;
	cloudProviderTokenUuid: string;
	privateKeyUuid: string;
	region: string;
	size: string;
	image: string;
	sshKeyIds: string[];
	firewallIds: string[];
	networkIds: string[];
	cloudInitScriptUuid: string;
	enableIpv4: boolean;
	enableIpv6: boolean;
	enableBackups: boolean;
	monitoring: boolean;
	disablePublicIpv4: boolean;
	instantValidate: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,255}$/;
const HOSTNAME_PATTERN =
	/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const checked = (value: unknown) => value === true || value === 'true' || value === '1';

function parseProvider(value: string | undefined): CloudProvider {
	const provider = cloudProvider(value);
	if (!provider) error(404, 'Cloud provider not found.');
	return provider;
}

function text(form: FormData, name: string) {
	return String(form.get(name) ?? '').trim();
}

function textList(form: FormData, name: string) {
	return [
		...new Set(
			form
				.getAll(name)
				.map((value) => String(value).trim())
				.filter(Boolean)
		)
	];
}

function bool(form: FormData, name: string, fallback: boolean) {
	const values = form.getAll(name);
	return values.length ? checked(values.at(-1)) : fallback;
}

function option(
	value: unknown,
	label: unknown,
	description: unknown = ''
): ProviderOption | undefined {
	const normalizedValue = String(value ?? '').trim();
	const normalizedLabel = String(label ?? '').trim();
	if (!normalizedValue || !ID_PATTERN.test(normalizedValue) || !normalizedLabel) return undefined;
	return {
		value: normalizedValue,
		label: normalizedLabel.slice(0, 255),
		description: String(description ?? '')
			.trim()
			.slice(0, 500)
	};
}

function options(
	value: unknown,
	presenter: (row: Record<string, unknown>) => ProviderOption | undefined
) {
	return normalizeRecords(value)
		.map(presenter)
		.filter((entry): entry is ProviderOption => entry !== undefined);
}

function numberSummary(row: Record<string, unknown>, fields: string[]) {
	return fields
		.map((field) => (row[field] === undefined ? '' : `${field.replaceAll('_', ' ')} ${row[field]}`))
		.filter(Boolean)
		.join(' · ');
}

async function readContext(provider: CloudProvider): Promise<CreationContext> {
	const [tokenValue, keyValue, scriptValue] = await Promise.all([
		getCoolifyClient().request('GET', '/cloud-tokens'),
		getCoolifyClient().request('GET', '/security/keys'),
		getCoolifyClient().request('GET', '/cloud-init-scripts')
	]);
	return {
		tokens: cloudTokenCollection(tokenValue).filter((token) => token.provider === provider),
		keys: normalizeRecords(keyValue)
			.map(privateKeyView)
			.filter((key): key is PrivateKeyChoice => key !== undefined),
		scripts: cloudInitScriptCollection(scriptValue)
	};
}

function emptyOptions(): ProviderOptions {
	return { regions: [], sizes: [], images: [], sshKeys: [], firewalls: [], networks: [] };
}

async function readProviderOptions(
	provider: CloudProvider,
	tokenUuid: string
): Promise<ProviderOptions> {
	const query = { cloud_provider_token_uuid: tokenUuid };
	if (provider === 'digitalocean') {
		const [regions, sizes, images, sshKeys] = await Promise.all(
			['regions', 'sizes', 'images', 'ssh-keys'].map((path) =>
				getCoolifyClient().request('GET', `/digitalocean/${path}`, { query })
			)
		);
		return {
			...emptyOptions(),
			regions: options(regions, (row) =>
				option(row.slug, `${firstText(row, ['name']) || row.slug} (${row.slug})`)
			),
			sizes: options(sizes, (row) =>
				option(
					row.slug,
					String(row.slug),
					[
						firstText(row, ['description']),
						numberSummary(row, ['vcpus', 'memory', 'disk', 'price_monthly'])
					]
						.filter(Boolean)
						.join(' · ')
				)
			),
			images: options(images, (row) =>
				option(row.slug ?? row.id, firstText(row, ['name', 'description', 'slug']) || row.id)
			),
			sshKeys: options(sshKeys, (row) => option(row.id, firstText(row, ['name']) || row.id))
		};
	}
	if (provider === 'hetzner') {
		const [regions, sizes, images, sshKeys, firewalls, networks] = await Promise.all(
			['locations', 'server-types', 'images', 'ssh-keys', 'firewalls', 'networks'].map((path) =>
				getCoolifyClient().request('GET', `/hetzner/${path}`, { query })
			)
		);
		return {
			regions: options(regions, (row) =>
				option(
					row.name,
					`${row.name} — ${[row.city, row.country].filter(Boolean).join(', ')}`,
					row.description
				)
			),
			sizes: options(sizes, (row) =>
				option(row.name, String(row.name), numberSummary(row, ['cores', 'memory', 'disk']))
			),
			images: options(images, (row) =>
				option(row.id, firstText(row, ['description', 'name']) || row.id)
			),
			sshKeys: options(sshKeys, (row) => option(row.id, firstText(row, ['name']) || row.id)),
			firewalls: options(firewalls, (row) => option(row.id, firstText(row, ['name']) || row.id)),
			networks: options(networks, (row) =>
				option(row.id, firstText(row, ['name']) || row.id, row.ip_range)
			)
		};
	}
	const [regions, sizes, images, sshKeys] = await Promise.all(
		['regions', 'plans', 'os', 'ssh-keys'].map((path) =>
			getCoolifyClient().request('GET', `/vultr/${path}`, { query })
		)
	);
	return {
		...emptyOptions(),
		regions: options(regions, (row) =>
			option(row.id, `${row.id} — ${[row.city, row.country].filter(Boolean).join(', ')}`)
		),
		sizes: options(sizes, (row) =>
			option(
				row.id,
				String(row.id),
				numberSummary(row, ['vcpu_count', 'ram', 'disk', 'monthly_cost'])
			)
		),
		images: options(images, (row) =>
			option(row.id, firstText(row, ['name', 'description']) || row.id)
		),
		sshKeys: options(sshKeys, (row) => option(row.id, firstText(row, ['name']) || row.id))
	};
}

function assertMutation(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
	return user;
}

function safeStatus(caught: unknown) {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

function safeOptionsError(caught: unknown) {
	if (isHttpError(caught)) return caught.body.message;
	return 'Provider options could not be loaded. Validate the selected token and try again.';
}

function safeCreationError(caught: unknown) {
	if (isHttpError(caught)) return caught.body.message;
	return 'Provider provisioning could not be confirmed. Check both Coolify and the provider before trying again. Do not submit the request automatically.';
}

export async function loadCloudServerCreation(
	providerValue: string,
	setHeaders: (headers: Record<string, string>) => void
) {
	const provider = parseProvider(providerValue);
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return { provider, ...(await readContext(provider)), requestError: '' };
	} catch {
		return {
			provider,
			tokens: [] as CloudTokenView[],
			keys: [] as PrivateKeyChoice[],
			scripts: [] as CloudInitScriptView[],
			requestError: 'Cloud provisioning prerequisites could not be loaded.'
		};
	}
}

export async function loadProviderOptionsAction(event: RequestEvent) {
	try {
		assertMutation(event);
		const provider = parseProvider(event.params.provider);
		const form = await event.request.formData();
		const cloudProviderTokenUuid = text(form, 'cloud_provider_token_uuid');
		const context = await readContext(provider);
		if (!context.tokens.some((token) => token.uuid === cloudProviderTokenUuid))
			error(400, `Select an available ${cloudProviderLabel(provider)} token.`);
		return {
			provider,
			values: { cloudProviderTokenUuid },
			options: await readProviderOptions(provider, cloudProviderTokenUuid)
		};
	} catch (caught) {
		return fail(safeStatus(caught), { error: safeOptionsError(caught) });
	}
}

function provisioningValues(form: FormData): ProvisioningValues {
	return {
		name: text(form, 'name').toLowerCase(),
		cloudProviderTokenUuid: text(form, 'cloud_provider_token_uuid'),
		privateKeyUuid: text(form, 'private_key_uuid'),
		region: text(form, 'region'),
		size: text(form, 'size'),
		image: text(form, 'image'),
		sshKeyIds: textList(form, 'ssh_key_ids'),
		firewallIds: textList(form, 'firewall_ids'),
		networkIds: textList(form, 'network_ids'),
		cloudInitScriptUuid: text(form, 'cloud_init_script_uuid'),
		enableIpv4: bool(form, 'enable_ipv4', true),
		enableIpv6: bool(form, 'enable_ipv6', true),
		enableBackups: bool(form, 'enable_backups', false),
		monitoring: bool(form, 'monitoring', true),
		disablePublicIpv4: bool(form, 'disable_public_ipv4', false),
		instantValidate: bool(form, 'instant_validate', false)
	};
}

function assertOption(options: ProviderOption[], selected: string, label: string) {
	if (!options.some((candidate) => candidate.value === selected))
		error(400, `Select an available ${label}.`);
}

function selectedIds(
	options: ProviderOption[],
	selected: string[],
	label: string,
	numeric: boolean
) {
	const available = new Set(options.map((entry) => entry.value));
	if (selected.some((entry) => !available.has(entry)))
		error(400, `Select only available ${label}.`);
	if (!numeric) return selected;
	const parsed = selected.map(Number);
	if (parsed.some((entry) => !Number.isSafeInteger(entry))) error(400, `Select valid ${label}.`);
	return parsed;
}

async function selectedScript(context: CreationContext, uuid: string) {
	if (!uuid) return undefined;
	if (!context.scripts.some((script) => script.uuid === uuid))
		error(400, 'Select an available cloud-init script.');
	const response = asRecord(
		await getCoolifyClient().request('GET', `/cloud-init-scripts/${encodeURIComponent(uuid)}`)
	);
	if (
		firstText(response, ['uuid']) !== uuid ||
		typeof response?.script !== 'string' ||
		!response.script
	)
		error(409, 'The selected cloud-init script is no longer available.');
	return response.script;
}

function confirmation(provider: CloudProvider, name: string) {
	return `PROVISION ${cloudProviderLabel(provider).toUpperCase()} ${name}`;
}

export async function createCloudServerAction(event: RequestEvent) {
	const started = Date.now();
	let values: ProvisioningValues | undefined;
	try {
		const user = assertMutation(event);
		const provider = parseProvider(event.params.provider);
		const form = await event.request.formData();
		values = provisioningValues(form);
		if (!values.name || values.name.length > 253 || !HOSTNAME_PATTERN.test(values.name))
			error(400, 'Enter a valid lowercase hostname no longer than 253 characters.');
		if (text(form, 'confirmation') !== confirmation(provider, values.name))
			error(400, `Type ${confirmation(provider, values.name)} exactly to confirm provisioning.`);

		const context = await readContext(provider);
		if (!context.tokens.some((token) => token.uuid === values!.cloudProviderTokenUuid))
			error(400, `Select an available ${cloudProviderLabel(provider)} token.`);
		if (!context.keys.some((key) => key.uuid === values!.privateKeyUuid))
			error(400, 'Select an available private key.');
		const providerOptions = await readProviderOptions(provider, values.cloudProviderTokenUuid);
		assertOption(providerOptions.regions, values.region, 'region');
		assertOption(providerOptions.sizes, values.size, 'server size');
		assertOption(providerOptions.images, values.image, 'operating system image');
		const cloudInitScript = await selectedScript(context, values.cloudInitScriptUuid);
		const base = {
			cloud_provider_token_uuid: values.cloudProviderTokenUuid,
			name: values.name,
			private_key_uuid: values.privateKeyUuid
		};
		let body: Record<string, unknown>;
		if (provider === 'digitalocean') {
			body = {
				cloud_provider_token_uuid: base.cloud_provider_token_uuid,
				region: values.region,
				size: values.size,
				image: values.image,
				name: base.name,
				private_key_uuid: base.private_key_uuid,
				enable_ipv6: values.enableIpv6,
				monitoring: values.monitoring,
				digitalocean_ssh_key_ids: selectedIds(
					providerOptions.sshKeys,
					values.sshKeyIds,
					'SSH keys',
					true
				),
				...(cloudInitScript ? { cloud_init_script: cloudInitScript } : {}),
				instant_validate: values.instantValidate
			};
		} else if (provider === 'hetzner') {
			if (!values.enableIpv4 && !values.enableIpv6)
				error(400, 'Enable at least one public IP protocol.');
			body = {
				cloud_provider_token_uuid: base.cloud_provider_token_uuid,
				location: values.region,
				server_type: values.size,
				image: Number(values.image),
				name: base.name,
				private_key_uuid: base.private_key_uuid,
				enable_ipv4: values.enableIpv4,
				enable_ipv6: values.enableIpv6,
				enable_backups: values.enableBackups,
				hetzner_ssh_key_ids: selectedIds(
					providerOptions.sshKeys,
					values.sshKeyIds,
					'SSH keys',
					true
				),
				hetzner_firewall_ids: selectedIds(
					providerOptions.firewalls,
					values.firewallIds,
					'firewalls',
					true
				),
				hetzner_network_ids: selectedIds(
					providerOptions.networks,
					values.networkIds,
					'networks',
					true
				),
				...(cloudInitScript ? { cloud_init_script: cloudInitScript } : {}),
				instant_validate: values.instantValidate
			};
		} else {
			if (values.disablePublicIpv4 && !values.enableIpv6)
				error(400, 'Enable IPv6 when disabling public IPv4.');
			body = {
				cloud_provider_token_uuid: base.cloud_provider_token_uuid,
				region: values.region,
				plan: values.size,
				os_id: Number(values.image),
				name: base.name,
				private_key_uuid: base.private_key_uuid,
				enable_ipv6: values.enableIpv6,
				disable_public_ipv4: values.disablePublicIpv4,
				vultr_ssh_key_ids: selectedIds(
					providerOptions.sshKeys,
					values.sshKeyIds,
					'SSH keys',
					false
				),
				...(cloudInitScript ? { cloud_init_script: cloudInitScript } : {}),
				instant_validate: values.instantValidate
			};
		}

		const response = asRecord(
			await getCoolifyClient().request('POST', `/servers/${provider}`, { body })
		);
		const uuid = firstText(response, ['uuid']);
		if (!ID_PATTERN.test(uuid))
			error(502, 'Coolify did not return the provisioned server identity.');
		invalidateCollection('servers');
		audit({
			user: user.username,
			operation: `provision-${provider}-server`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		redirect(303, `/servers/${encodeURIComponent(uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		audit({
			user: event.locals.user?.username,
			operation: `provision-${event.params.provider ?? 'cloud'}-server`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(safeStatus(caught), { error: safeCreationError(caught), values });
	}
}
