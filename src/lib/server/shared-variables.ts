import { error, fail, isHttpError, json, type RequestEvent } from '@sveltejs/kit';
import { asRecord, normalizeRecords } from '../resource-presenter';
import { teamView, type TeamView } from '../administration-presenter';
import { applicationEnvironmentVariableFailure } from './application-environment-variables';
import { CoolifyError } from './coolify-client';
import { loadHierarchy, loadHierarchyPage } from './project-actions';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const numericId = (value: unknown) => /^[1-9][0-9]*$/.test(String(value ?? ''));
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
export interface SharedVariableValues {
	key: string;
	comment: string;
	is_literal: boolean;
	is_multiline: boolean;
	is_shown_once: boolean;
}
export interface SharedVariableRow extends SharedVariableValues {
	id: string;
}
export interface SharedVariableResult {
	target?: string;
	operation?: string;
	error?: string;
	message?: string;
	values?: SharedVariableValues;
	fieldErrors?: Record<string, string>;
}
export function sharedVariableRows(value: unknown): SharedVariableRow[] {
	return normalizeRecords(value)
		.filter((row) => numericId(row.id))
		.map((row) => ({
			id: String(row.id),
			key: String(row.key ?? ''),
			comment: String(row.comment ?? ''),
			is_literal: flag(row.is_literal),
			is_multiline: flag(row.is_multiline),
			is_shown_once: flag(row.is_shown_once)
		}));
}
export function sharedVariableSubmission(form: FormData, update = false) {
	const values: SharedVariableValues = {
		key: String(form.get('key') ?? '').trim(),
		comment: String(form.get('comment') ?? '').trim(),
		is_literal: flag(form.getAll('is_literal').at(-1)),
		is_multiline: flag(form.getAll('is_multiline').at(-1)),
		is_shown_once: flag(form.getAll('is_shown_once').at(-1))
	};
	const rawValue = String(form.get('value') ?? '');
	const mode = update ? String(form.get('value_mode') ?? 'keep') : 'replace';
	const fieldErrors: Record<string, string> = {};
	if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(values.key) || values.key.length > 255)
		fieldErrors.key =
			'Use a key up to 255 characters, starting with a letter or underscore; letters, numbers, underscores and dots are allowed.';
	if (values.comment.length > 256) fieldErrors.comment = 'Use at most 256 characters.';
	if (!['keep', 'replace', 'clear'].includes(mode))
		fieldErrors.value_mode = 'Select keep, replace or clear.';
	const body: Record<string, unknown> = { ...values, comment: values.comment || null };
	if (mode === 'replace') body.value = rawValue;
	if (mode === 'clear') body.value = null;
	return {
		values,
		body: Object.keys(fieldErrors).length ? undefined : body,
		fieldErrors,
		sensitiveValues: rawValue ? [rawValue] : []
	};
}
function status(caught: unknown) {
	const value = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return value >= 400 && value <= 599 ? value : 500;
}
function assertRequest(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}
function variableFailure(caught: unknown, sensitiveValues: string[]) {
	return applicationEnvironmentVariableFailure(
		isHttpError(caught) ? new CoolifyError(caught.body.message, caught.status) : caught,
		sensitiveValues
	);
}
interface SharedVariableScope {
	apiHref: string;
	team?: TeamView;
}
type SharedVariableScopeResolver = (event: RequestEvent) => Promise<SharedVariableScope>;
const hierarchyScope: SharedVariableScopeResolver = async (event) => {
	const context = await loadHierarchy(event);
	return { apiHref: context.href };
};
const serverScope: SharedVariableScopeResolver = async (event) => {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	return { apiHref: `/servers/${encodeURIComponent(uuid)}` };
};
const teamScope: SharedVariableScopeResolver = async (event) => {
	const id = event.params.uuid ?? '';
	if (!/^[0-9]+$/.test(id)) error(404, 'Team not found.');
	const team = teamView(await getCoolifyClient().request('GET', '/team'));
	if (!team || team.id !== id) error(404, 'Team not found.');
	return { apiHref: '/team', team };
};
export async function loadSharedVariables(event: RequestEvent) {
	const context = await loadHierarchyPage(event, 'shared-variables');
	try {
		const result = await getCoolifyClient().request('GET', `${context.href}/envs`);
		return {
			...context,
			revealHref: `${context.href}/shared-variables/reveal`,
			variables: sharedVariableRows(result),
			requestError: ''
		};
	} catch {
		return {
			...context,
			revealHref: `${context.href}/shared-variables/reveal`,
			variables: [],
			requestError:
				'Shared variables could not be loaded. Check the API connection and token permissions, then refresh.'
		};
	}
}
export async function loadServerSharedVariables(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	const context = await loadServer(uuid);
	const href = `/servers/${encodeURIComponent(uuid)}`;
	try {
		const result = await getCoolifyClient().request('GET', `${href}/envs`);
		return {
			...context,
			href,
			kind: 'server' as const,
			revealHref: `${href}/environment-variables/reveal`,
			variables: sharedVariableRows(result),
			requestError: ''
		};
	} catch {
		return {
			...context,
			href,
			kind: 'server' as const,
			revealHref: `${href}/environment-variables/reveal`,
			variables: [],
			requestError:
				'Shared variables could not be loaded. Check the API connection and token permissions, then refresh.'
		};
	}
}
export async function loadTeamSharedVariables(event: RequestEvent) {
	event.setHeaders({ 'cache-control': 'no-store' });
	const context = await teamScope(event);
	const href = `/teams/${encodeURIComponent(context.team!.id)}`;
	try {
		const result = await getCoolifyClient().request('GET', '/team/envs');
		return {
			team: context.team!,
			href,
			kind: 'team' as const,
			breadcrumbs: [
				{ label: 'Teams', href: '/teams' },
				{ label: context.team!.name, href },
				{ label: 'Shared variables', href: `${href}/shared-variables` }
			],
			revealHref: `${href}/shared-variables/reveal`,
			variables: sharedVariableRows(result),
			requestError: ''
		};
	} catch {
		return {
			team: context.team!,
			href,
			kind: 'team' as const,
			breadcrumbs: [
				{ label: 'Teams', href: '/teams' },
				{ label: context.team!.name, href },
				{ label: 'Shared variables', href: `${href}/shared-variables` }
			],
			revealHref: `${href}/shared-variables/reveal`,
			variables: [],
			requestError:
				'Shared variables could not be loaded. Check the API connection and token permissions, then refresh.'
		};
	}
}
async function mutate(
	event: RequestEvent,
	operation: 'create' | 'update' | 'delete',
	resolveScope: SharedVariableScopeResolver = hierarchyScope
) {
	let target = operation === 'create' ? 'create' : '';
	let values: SharedVariableValues | undefined;
	let sensitiveValues: string[] = [];
	const started = Date.now();
	try {
		assertRequest(event);
		const form = await event.request.formData();
		if (operation !== 'create') {
			target = String(form.get('id') ?? '');
			if (!numericId(target)) error(400, 'A numeric shared-variable ID is required.');
		}
		const submission =
			operation === 'delete' ? undefined : sharedVariableSubmission(form, operation === 'update');
		if (submission) {
			values = submission.values;
			sensitiveValues = submission.sensitiveValues;
			if (!submission.body)
				return fail(400, {
					error: 'Correct the highlighted fields.',
					target,
					operation,
					values,
					fieldErrors: submission.fieldErrors
				});
		}
		const context = await resolveScope(event);
		const path = `${context.apiHref}/envs`;
		if (operation !== 'create') {
			const rows = normalizeRecords(await getCoolifyClient().request('GET', path));
			const variable = rows.find((row) => String(row.id) === target);
			if (!variable) error(404, 'Shared variable not found in this scope.');
			if (typeof variable.value === 'string' && variable.value)
				sensitiveValues.push(variable.value);
			if (
				operation === 'delete' &&
				(!variable.key || String(form.get('confirmation') ?? '') !== variable.key)
			)
				error(400, 'Type the variable key exactly to confirm deletion.');
		}
		if (operation === 'delete') await getCoolifyClient().request('DELETE', `${path}/${target}`);
		else
			await getCoolifyClient().request(
				operation === 'create' ? 'POST' : 'PATCH',
				operation === 'create' ? path : `${path}/${target}`,
				{ body: submission!.body }
			);
		// Shared-variable responses may contain plaintext. Never serialize the mutation response.
		audit({
			user: event.locals.user?.username,
			operation: `${operation}-shared-variable`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return {
			message: `Shared variable ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`,
			target,
			operation
		};
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation: `${operation}-shared-variable`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			...variableFailure(caught, sensitiveValues),
			target,
			operation,
			values
		});
	}
}
export const sharedVariableActions = {
	createVariable: (event: RequestEvent) => mutate(event, 'create'),
	updateVariable: (event: RequestEvent) => mutate(event, 'update'),
	deleteVariable: (event: RequestEvent) => mutate(event, 'delete')
};
export const serverSharedVariableActions = {
	createVariable: (event: RequestEvent) => mutate(event, 'create', serverScope),
	updateVariable: (event: RequestEvent) => mutate(event, 'update', serverScope),
	deleteVariable: (event: RequestEvent) => mutate(event, 'delete', serverScope)
};
export const teamSharedVariableActions = {
	createVariable: (event: RequestEvent) => mutate(event, 'create', teamScope),
	updateVariable: (event: RequestEvent) => mutate(event, 'update', teamScope),
	deleteVariable: (event: RequestEvent) => mutate(event, 'delete', teamScope)
};
async function reveal(event: RequestEvent, resolveScope: SharedVariableScopeResolver) {
	const headers = { 'cache-control': 'no-store' };
	try {
		assertRequest(event);
		let body: Record<string, unknown> | undefined;
		try {
			body = asRecord(await event.request.json());
		} catch {
			error(400, 'Invalid request.');
		}
		if (!numericId(body?.id)) error(400, 'A numeric shared-variable ID is required.');
		const context = await resolveScope(event);
		const rows = normalizeRecords(
			await getCoolifyClient().request('GET', `${context.apiHref}/envs`)
		);
		const variable = rows.find((row) => String(row.id) === String(body?.id));
		if (!variable) error(404, 'Shared variable not found.');
		if (
			flag(variable.is_shown_once) ||
			(typeof variable.value !== 'string' && variable.value !== null)
		)
			error(403, 'Value unavailable.');
		audit({
			user: event.locals.user?.username,
			operation: 'reveal-shared-variable',
			result: 'secret-revealed'
		});
		return json({ value: variable.value }, { headers });
	} catch (caught) {
		const code = status(caught);
		const message =
			code === 401
				? 'Authentication required.'
				: code === 403
					? 'Value unavailable. A same-origin request and sensitive-read permission are required; shown-once values cannot be revealed.'
					: code === 404
						? 'Shared variable or parent not found.'
						: code === 400
							? 'Invalid reveal request.'
							: 'Value could not be revealed. Try again later.';
		return json({ message }, { status: code, headers });
	}
}
export const revealSharedVariable = (event: RequestEvent) => reveal(event, hierarchyScope);
export const revealServerSharedVariable = (event: RequestEvent) => reveal(event, serverScope);
export const revealTeamSharedVariable = (event: RequestEvent) => reveal(event, teamScope);
