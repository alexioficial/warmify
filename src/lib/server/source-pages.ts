import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import {
	sourceCollection,
	sourceView,
	type SourceProvider,
	type SourceView
} from '$lib/source-presenter';
import { CoolifyError } from './coolify-client';
import { collectionSnapshotForPage, invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

export { sourceView } from '$lib/source-presenter';

export interface SourceKeyChoice {
	id?: number;
	uuid: string;
	name: string;
	description: string;
}

export interface GithubRepository {
	name: string;
	fullName: string;
	isPrivate: boolean;
	defaultBranch: string;
}

const validUuid = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const integer = (value: unknown) => {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
};
const checked = (value: unknown) => value === true || value === 'true' || value === '1';

function sourcePath(provider: SourceProvider) {
	return `/${provider}-apps` as const;
}

function parseProvider(value: string | undefined): SourceProvider {
	if (value === 'github' || value === 'gitlab') return value;
	error(404, 'Source not found.');
}

function parseId(value: string | undefined): number {
	const id = Number(value);
	if (!Number.isSafeInteger(id) || id < 1) error(404, 'Source not found.');
	return id;
}

function keyView(value: unknown): SourceKeyChoice | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validUuid(uuid)) return undefined;
	return {
		id: integer(row?.id),
		uuid,
		name: firstText(row, ['name']) || 'Private key',
		description: firstText(row, ['description'])
	};
}

async function readKeys(): Promise<SourceKeyChoice[]> {
	return normalizeRecords(await getCoolifyClient().request('GET', '/security/keys'))
		.map(keyView)
		.filter((key): key is SourceKeyChoice => key !== undefined);
}

export async function loadSourceCreation(providerValue: string) {
	const provider = parseProvider(providerValue);
	try {
		return {
			provider,
			keys: provider === 'github' ? await readKeys() : [],
			requestError: ''
		};
	} catch {
		return {
			provider,
			keys: [] as SourceKeyChoice[],
			requestError:
				provider === 'github'
					? 'Private keys could not be loaded.'
					: 'Source creation could not be prepared.'
		};
	}
}

export async function loadSourcesIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('sources');
		return {
			sources: sourceCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return {
			sources: [] as SourceView[],
			sync: null,
			requestError: 'Sources could not be loaded.'
		};
	}
}

async function readSourceContext(
	provider: SourceProvider,
	id: number,
	includeKeys: boolean
): Promise<{ source: SourceView; keys: SourceKeyChoice[] }> {
	const [teamValue, sourcesValue, keys] = await Promise.all([
		getCoolifyClient().request('GET', '/team'),
		getCoolifyClient().request('GET', sourcePath(provider)),
		includeKeys ? readKeys() : Promise.resolve([] as SourceKeyChoice[])
	]);
	const teamId = integer(asRecord(teamValue)?.id);
	if (!teamId) error(502, 'The current team could not be identified.');
	const source = normalizeRecords(sourcesValue)
		.map((row) => sourceView(row, provider, teamId))
		.find((candidate) => candidate?.id === id);
	if (!source) error(404, 'Source not found.');
	return { source, keys };
}

export async function loadSource(providerValue: string, idValue: string) {
	const provider = parseProvider(providerValue);
	const id = parseId(idValue);
	try {
		const { source, keys } = await readSourceContext(provider, id, true);
		return {
			provider,
			id: String(id),
			source,
			keys,
			breadcrumbs: [
				{ label: 'Sources', href: '/sources' },
				{
					label: source.name,
					href: `/sources/${provider}/${id}/general`
				}
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Source could not be loaded.'
		);
	}
}

function repositoryView(value: unknown): GithubRepository | undefined {
	const row = asRecord(value);
	const fullName = firstText(row, ['full_name']);
	const parts = fullName.split('/');
	if (parts.length !== 2 || parts.some((part) => !part || part.length > 255)) return undefined;
	return {
		name: firstText(row, ['name']) || parts[1],
		fullName,
		isPrivate: checked(row?.private),
		defaultBranch: firstText(row, ['default_branch'])
	};
}

async function readGithubRepositories(id: number): Promise<GithubRepository[]> {
	const { source } = await readSourceContext('github', id, false);
	if (!source.owned) error(403, 'Shared system-wide sources are read-only for this team.');
	const response = asRecord(
		await getCoolifyClient().request('GET', `/github-apps/${id}/repositories`)
	);
	return normalizeRecords(response?.repositories)
		.map(repositoryView)
		.filter((repository): repository is GithubRepository => repository !== undefined)
		.sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function loadGithubRepositories(idValue: string) {
	const id = parseId(idValue);
	try {
		return { repositories: await readGithubRepositories(id), requestError: '' };
	} catch (caught) {
		if (isHttpError(caught) && [403, 404].includes(caught.status)) throw caught;
		return {
			repositories: [] as GithubRepository[],
			requestError: 'GitHub repositories could not be loaded.'
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

function safeError(caught: unknown, operation: 'create' | 'update' | 'delete' | 'discover') {
	if (caught instanceof CoolifyError && caught.status === 409)
		return operation === 'delete'
			? 'Move every application away from this source before deleting it.'
			: 'This source conflicts with an existing provider configuration.';
	if (isHttpError(caught)) return caught.body.message;
	return operation === 'discover'
		? 'Repository information could not be loaded.'
		: `The source could not be ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`;
}

function normalizeUrl(value: string, required: boolean): string | undefined {
	if (!value) {
		if (required) error(400, 'Enter a valid provider URL.');
		return undefined;
	}
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
			error(400, 'Enter a valid HTTP or HTTPS provider URL.');
		return url.toString().replace(/\/$/, '');
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(400, 'Enter a valid HTTP or HTTPS provider URL.');
	}
}

function requiredInteger(form: FormData, name: string, minimum = 1): number {
	const value = Number(form.get(name));
	if (!Number.isSafeInteger(value) || value < minimum) error(400, 'Enter valid provider IDs.');
	return value;
}

function port(form: FormData): number {
	const value = Number(form.get('custom_port') || 22);
	if (!Number.isSafeInteger(value) || value < 1 || value > 65535)
		error(400, 'Enter a valid SSH port.');
	return value;
}

function text(form: FormData, name: string) {
	return String(form.get(name) ?? '').trim();
}

function baseValues(form: FormData) {
	const name = text(form, 'name');
	const customUser = text(form, 'custom_user') || 'git';
	if (!name || name.length > 255) error(400, 'Enter a valid source name.');
	if (!customUser || customUser.length > 255) error(400, 'Enter a valid Git SSH user.');
	return {
		name,
		htmlUrl: normalizeUrl(text(form, 'html_url'), true)!,
		apiUrl: normalizeUrl(text(form, 'api_url'), false),
		customUser,
		customPort: port(form),
		isSystemWide: checked(form.getAll('is_system_wide').at(-1))
	};
}

function githubBody(form: FormData, keys: SourceKeyChoice[], creating: boolean) {
	const base = baseValues(form);
	const organization = text(form, 'organization').replace(/^@/, '');
	if (organization && (!/^[^\s/?#]+$/.test(organization) || organization.length > 255))
		error(400, 'Enter a valid GitHub organization.');
	const clientId = text(form, 'client_id');
	const clientSecret = text(form, 'client_secret');
	const webhookSecret = text(form, 'webhook_secret');
	const privateKeyUuid = text(form, 'private_key_uuid');
	if (!clientId || clientId.length > 255) error(400, 'Enter a valid GitHub client ID.');
	if (creating && (!clientSecret || !webhookSecret))
		error(400, 'Client and webhook secrets are required when creating a GitHub App.');
	if (creating && !keys.some((key) => key.uuid === privateKeyUuid))
		error(400, 'Select a private key owned by this team.');
	if (privateKeyUuid && !keys.some((key) => key.uuid === privateKeyUuid))
		error(400, 'The selected private key is not available to this team.');
	return {
		body: {
			name: base.name,
			organization: organization || null,
			...(base.apiUrl ? { api_url: base.apiUrl } : {}),
			html_url: base.htmlUrl,
			custom_user: base.customUser,
			custom_port: base.customPort,
			app_id: requiredInteger(form, 'app_id'),
			installation_id: requiredInteger(form, 'installation_id'),
			client_id: clientId,
			...(clientSecret ? { client_secret: clientSecret } : {}),
			...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
			...(privateKeyUuid ? { private_key_uuid: privateKeyUuid } : {}),
			is_system_wide: base.isSystemWide
		},
		values: {
			name: base.name,
			organization,
			apiUrl: base.apiUrl ?? '',
			htmlUrl: base.htmlUrl,
			customUser: base.customUser,
			customPort: base.customPort,
			appId: Number(form.get('app_id')),
			installationId: Number(form.get('installation_id')),
			clientId,
			privateKeyUuid,
			isSystemWide: base.isSystemWide
		}
	};
}

function gitlabBody(form: FormData) {
	const base = baseValues(form);
	const groupName = text(form, 'group_name');
	const clientId = text(form, 'client_id');
	const clientSecret = text(form, 'client_secret');
	const webhookToken = text(form, 'webhook_token');
	const redirectValue = text(form, 'redirect_uri');
	const redirectUri = normalizeUrl(redirectValue, false);
	if (groupName.length > 255 || clientId.length > 255)
		error(400, 'GitLab group and application ID must be 255 characters or fewer.');
	return {
		body: {
			name: base.name,
			html_url: base.htmlUrl,
			...(base.apiUrl ? { api_url: base.apiUrl } : {}),
			custom_user: base.customUser,
			custom_port: base.customPort,
			group_name: groupName || null,
			client_id: clientId || null,
			...(clientSecret ? { client_secret: clientSecret } : {}),
			...(webhookToken ? { webhook_token: webhookToken } : {}),
			redirect_uri: redirectUri ?? null,
			is_system_wide: base.isSystemWide
		},
		values: {
			name: base.name,
			apiUrl: base.apiUrl ?? '',
			htmlUrl: base.htmlUrl,
			customUser: base.customUser,
			customPort: base.customPort,
			groupName,
			clientId,
			redirectUri: redirectUri ?? '',
			isSystemWide: base.isSystemWide
		}
	};
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

export async function createSourceAction(event: RequestEvent, providerValue: string) {
	const provider = parseProvider(providerValue);
	const started = Date.now();
	let values: Record<string, unknown> = {};
	try {
		assertMutation(event);
		const form = await event.request.formData();
		const keys = provider === 'github' ? await readKeys() : [];
		const submission = provider === 'github' ? githubBody(form, keys, true) : gitlabBody(form);
		values = submission.values;
		const result = asRecord(
			await getCoolifyClient().request('POST', sourcePath(provider), {
				body: submission.body
			})
		);
		const id = integer(result?.id);
		invalidateCollection('sources');
		auditResult(event, `create-${provider}-app`, 'success', started);
		if (!id) return { message: `${provider === 'github' ? 'GitHub' : 'GitLab'} App created.` };
		redirect(303, `/sources/${provider}/${id}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `create-${provider}-app`, 'error', started);
		return fail(safeStatus(caught), { error: safeError(caught, 'create'), values });
	}
}

async function sourceMutation(
	event: RequestEvent,
	operation: 'update' | 'delete',
	callback: (
		provider: SourceProvider,
		id: number,
		source: SourceView,
		keys: SourceKeyChoice[],
		form: FormData
	) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const provider = parseProvider(event.params.provider);
		const id = parseId(event.params.id);
		const { source, keys } = await readSourceContext(provider, id, true);
		if (!source.owned) error(403, 'Shared system-wide sources are read-only for this team.');
		const result = await callback(provider, id, source, keys, await event.request.formData());
		auditResult(event, `${operation}-${provider}-app`, 'success', started);
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `${operation}-source`, 'error', started);
		return fail(safeStatus(caught), { error: safeError(caught, operation) });
	}
}

export const sourceActions = {
	update: (event: RequestEvent) =>
		sourceMutation(event, 'update', async (provider, id, _source, keys, form) => {
			const submission = provider === 'github' ? githubBody(form, keys, false) : gitlabBody(form);
			await getCoolifyClient().request('PATCH', `${sourcePath(provider)}/${id}`, {
				body: submission.body
			});
			invalidateCollection('sources');
			return { message: `${provider === 'github' ? 'GitHub' : 'GitLab'} App settings saved.` };
		}),
	delete: (event: RequestEvent) =>
		sourceMutation(event, 'delete', async (provider, id, source, _keys, form) => {
			const confirmation = text(form, 'confirmation');
			if (confirmation !== source.name && confirmation !== source.uuid)
				error(400, 'Type the source name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request('DELETE', `${sourcePath(provider)}/${id}`);
			invalidateCollection('sources');
			redirect(303, '/sources');
		}),
	loadBranches: async (event: RequestEvent) => {
		try {
			assertMutation(event);
			if (parseProvider(event.params.provider) !== 'github') error(404, 'Action not available.');
			const id = parseId(event.params.id);
			const form = await event.request.formData();
			const repository = text(form, 'repository');
			const repositories = await readGithubRepositories(id);
			if (!repositories.some((candidate) => candidate.fullName === repository))
				error(400, 'Select a repository from this GitHub App.');
			const [owner, repo] = repository.split('/');
			const response = asRecord(
				await getCoolifyClient().request(
					'GET',
					`/github-apps/${id}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
				)
			);
			const branches = normalizeRecords(response?.branches)
				.map((branch) => firstText(branch, ['name']))
				.filter(Boolean)
				.sort((left, right) => left.localeCompare(right));
			return { repository, branches };
		} catch (caught) {
			return fail(safeStatus(caught), { error: safeError(caught, 'discover') });
		}
	}
};
