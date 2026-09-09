import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { configurationFailure } from './resource-actions';
import { audit, getCoolifyClient } from './runtime';

const fields = [
	{ name: 'name', label: 'Name' },
	{ name: 'description', label: 'Description' }
];
export function hierarchySubmission(form: FormData, nameOnly = false) {
	const name = String(form.get('name') ?? '').trim();
	const description = nameOnly ? '' : String(form.get('description') ?? '').trim();
	const values = { name, description };
	const fieldErrors: Record<string, string> = {};
	if (
		[...name].length < 3 ||
		[...name].length > 255 ||
		!/^[\p{L}\p{M}\p{N}\s\-_.@/&()#,:+]+$/u.test(name)
	)
		fieldErrors.name =
			'Use 3–255 characters: letters, numbers, spaces, or - _ . / @ & ( ) # , : +.';
	if (
		[...description].length > 255 ||
		(description && !/^[\p{L}\p{M}\p{N}\s\-_.,!?()'"+=*@/&]+$/u.test(description))
	)
		fieldErrors.description =
			'Use at most 255 characters with letters, numbers, spaces and standard punctuation.';
	return {
		body: nameOnly ? { name } : { name, description: description || null },
		values,
		fieldErrors
	};
}
function projectPath(event: RequestEvent): `/projects/${string}` {
	if (!event.params.uuid) error(404, 'Project not found.');
	return `/projects/${encodeURIComponent(event.params.uuid)}`;
}
function failure(caught: unknown) {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return {
		status: status >= 400 && status <= 599 ? status : 500,
		...configurationFailure(
			isHttpError(caught) ? new Error(caught.body.message) : caught,
			fields,
			[]
		)
	};
}
function invalidateHierarchy() {
	for (const group of ['projects', 'resources']) invalidateCollection(group);
}
export async function loadHierarchy(event: RequestEvent) {
	const path = projectPath(event);
	const project = asRecord(await getCoolifyClient().request('GET', path));
	if (!project || project.uuid !== event.params.uuid) error(404, 'Project not found.');
	const projectName = firstText(project, ['name']) || 'Project';
	const breadcrumbs = [
		{ label: 'Projects', href: '/projects' },
		{ label: projectName, href: path }
	];
	let current = project;
	let href = path;
	if (event.params.environment) {
		const environment = asRecord(
			await getCoolifyClient().request(
				'GET',
				`${path}/${encodeURIComponent(event.params.environment)}`
			)
		);
		if (!environment || environment.uuid !== event.params.environment)
			error(404, 'Environment not found in this project.');
		current = environment;
		href = `${path}/environments/${encodeURIComponent(event.params.environment)}`;
		breadcrumbs.push({ label: firstText(current, ['name']) || 'Environment', href });
	}
	return {
		uuid: firstText(current, ['uuid']),
		name: firstText(current, ['name']),
		description: firstText(current, ['description']),
		href,
		projectPath: path,
		projectName,
		kind: event.params.environment ? ('environment' as const) : ('project' as const),
		breadcrumbs
	};
}
export async function loadHierarchyPage(
	event: RequestEvent,
	section: 'settings' | 'danger' | 'shared-variables'
) {
	event.setHeaders({ 'cache-control': 'no-store' });
	try {
		const context = await loadHierarchy(event);
		return {
			...context,
			section,
			breadcrumbs: [
				...context.breadcrumbs,
				{
					label:
						section === 'settings'
							? 'Settings'
							: section === 'danger'
								? 'Danger zone'
								: 'Shared variables',
					href: `${context.href}/${section}`
				}
			]
		};
	} catch (caught) {
		const result = failure(caught);
		error(result.status, result.error);
	}
}
async function create(event: RequestEvent, kind: 'project' | 'environment') {
	const submission = hierarchySubmission(await event.request.formData(), kind === 'environment');
	if (Object.keys(submission.fieldErrors).length)
		return fail(400, { error: 'Correct the highlighted fields.', ...submission });
	const started = Date.now();
	try {
		const path = kind === 'project' ? '/projects' : projectPath(event);
		if (kind === 'environment') await loadHierarchy(event);
		const result = await getCoolifyClient().request(
			'POST',
			kind === 'project' ? path : `${path}/environments`,
			{ body: submission.body }
		);
		invalidateHierarchy();
		audit({
			user: event.locals.user?.username,
			operation: `create-${kind}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		const uuid = firstText(asRecord(result), ['uuid']);
		// An unusual successful response without UUID must not invite an automatic duplicate create.
		if (!uuid)
			return {
				message: `${kind === 'project' ? 'Project' : 'Environment'} created. Refresh the list to find it.`
			};
		redirect(
			303,
			kind === 'project'
				? `/projects/${encodeURIComponent(uuid)}`
				: `${path}/environments/${encodeURIComponent(uuid)}`
		);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		audit({
			user: event.locals.user?.username,
			operation: `create-${kind}`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		const result = failure(caught);
		return fail(result.status, {
			error: result.error,
			fieldErrors: result.fieldErrors,
			values: submission.values
		});
	}
}
export const createProject = (event: RequestEvent) => create(event, 'project');
export const createEnvironment = (event: RequestEvent) => create(event, 'environment');
export async function updateHierarchy(event: RequestEvent) {
	const submission = hierarchySubmission(await event.request.formData());
	if (Object.keys(submission.fieldErrors).length)
		return fail(400, { error: 'Correct the highlighted fields.', ...submission });
	const started = Date.now();
	try {
		const context = await loadHierarchy(event);
		await getCoolifyClient().request('PATCH', context.href, { body: submission.body });
		invalidateHierarchy();
		audit({
			user: event.locals.user?.username,
			operation: `update-${context.kind}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { message: 'Settings saved.' };
	} catch (caught) {
		const result = failure(caught);
		audit({
			user: event.locals.user?.username,
			operation: 'update-hierarchy',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(result.status, {
			error: result.error,
			fieldErrors: result.fieldErrors,
			values: submission.values
		});
	}
}
export async function deleteHierarchy(event: RequestEvent) {
	const form = await event.request.formData();
	const confirmation = String(form.get('confirmation') ?? '');
	const started = Date.now();
	try {
		const context = await loadHierarchy(event);
		if (
			!confirmation ||
			(confirmation !== context.uuid && (!context.name || confirmation !== context.name))
		)
			return fail(400, { error: 'Type the name or UUID exactly to confirm deletion.' });
		// Coolify refuses populated parents. Never delete their child resources to bypass this guard.
		await getCoolifyClient().request('DELETE', context.href);
		invalidateHierarchy();
		audit({
			user: event.locals.user?.username,
			operation: `delete-${context.kind}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		redirect(303, context.kind === 'project' ? '/projects' : context.projectPath);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		const result = failure(caught);
		audit({
			user: event.locals.user?.username,
			operation: 'delete-hierarchy',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(result.status, { error: result.error });
	}
}
