import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText, normalizeRecords, type ResourceRecord } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { deploymentCollection } from './deployment-presenter';
import { collectionForPage, invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
export function deploymentLogs(value: unknown) {
	if (value == null) return { available: false, text: '', truncated: false };
	let parsed: unknown = value;
	if (typeof value === 'string' && /^\s*[[{]/.test(value)) {
		try {
			parsed = JSON.parse(value);
		} catch {
			return { available: false, text: '', truncated: false };
		}
	}
	let text: string;
	if (typeof parsed === 'string') text = parsed;
	else if (Array.isArray(parsed))
		text = parsed
			.map((entry) => {
				const row = asRecord(entry);
				if (
					!row ||
					[true, 1, '1', 'true'].includes(row.hidden as string | number | boolean) ||
					typeof row.output !== 'string'
				)
					return '';
				const timestamp =
					typeof row.timestamp === 'string' && /^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/.test(row.timestamp)
						? `[${row.timestamp}] `
						: '';
				return timestamp + row.output;
			})
			.filter(Boolean)
			.join('\n');
	else return { available: false, text: '', truncated: false };
	// Output is user-visible text, never serialized command/configuration objects.
	text = text
		.replace(
			/(\b(?:password|passwd|secret|token|api_key|private_key)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
			'$1[REDACTED]'
		)
		.replace(/(\bAuthorization\s*:\s*Bearer\s+)\S+/gi, '$1[REDACTED]')
		.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@');
	return { available: true, text: text.slice(-200000), truncated: text.length > 200000 };
}
export function deploymentSnapshot(value: unknown, uuid: string) {
	const row = asRecord(value);
	if (!validId(uuid) || row?.deployment_uuid !== uuid) error(404, 'Deployment not found.');
	return { deployment: deploymentCollection([row])[0], logs: deploymentLogs(row.logs) };
}
interface ContextLink {
	label: string;
	href: '/projects' | `/projects/${string}` | `/applications/${string}`;
}
export function deploymentContext(
	deployment: ResourceRecord,
	applications: unknown,
	projects: unknown
): ContextLink[] {
	const appId = firstText(deployment, ['application_id']);
	const appUuid = firstText(deployment, ['application_uuid']);
	const app = normalizeRecords(applications).find(
		(row) =>
			(appId || appUuid) &&
			(!appId || firstText(row, ['id']) === appId) &&
			(!appUuid || row.uuid === appUuid)
	);
	const uuid = firstText(app, ['uuid']);
	if (!app || !validId(uuid)) return [];
	const links: ContextLink[] = [];
	const environmentId = firstText(app, ['environment_id', 'environment_uuid']);
	for (const project of normalizeRecords(projects)) {
		const environment = normalizeRecords(project.environments).find(
			(row) =>
				environmentId && [firstText(row, ['id']), firstText(row, ['uuid'])].includes(environmentId)
		);
		const projectUuid = firstText(project, ['uuid']);
		const environmentUuid = firstText(environment, ['uuid']);
		if (!environment || !validId(projectUuid) || !validId(environmentUuid)) continue;
		links.push(
			{ label: 'Projects', href: '/projects' },
			{
				label: firstText(project, ['name']) || 'Project',
				href: `/projects/${encodeURIComponent(projectUuid)}`
			},
			{
				label: firstText(environment, ['name']) || 'Environment',
				href: `/projects/${encodeURIComponent(projectUuid)}/environments/${encodeURIComponent(environmentUuid)}`
			}
		);
		break;
	}
	links.push(
		{
			label: firstText(app, ['name']) || 'Application',
			href: `/applications/${encodeURIComponent(uuid)}/general`
		},
		{
			label: 'Application deployments',
			href: `/applications/${encodeURIComponent(uuid)}/deployments`
		}
	);
	return links;
}
async function readDeployment(uuid: string) {
	if (!validId(uuid)) error(404, 'Deployment not found.');
	const result = await getCoolifyClient().request(
		'GET',
		`/deployments/${encodeURIComponent(uuid)}`
	);
	deploymentSnapshot(result, uuid);
	return asRecord(result)!;
}
export async function loadDeploymentPage(uuid: string) {
	try {
		const [raw, applications, projects] = await Promise.all([
			readDeployment(uuid),
			collectionForPage('applications').catch(() => []),
			collectionForPage('projects').catch(() => [])
		]);
		const context = deploymentContext(raw, applications, projects);
		return {
			uuid,
			...deploymentSnapshot(raw, uuid),
			context,
			breadcrumbs: [
				{ label: 'Deployments', href: '/deployments' },
				...context.filter((link) => link.label !== 'Application deployments'),
				{
					label: firstText(raw, ['application_name']) || 'Deployment',
					href: `/deployments/${encodeURIComponent(uuid)}`
				}
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'Deployment could not be loaded.'
		);
	}
}
export async function cancelDeployment(event: RequestEvent) {
	const started = Date.now();
	let submitted = false;
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		if ((await event.request.formData()).get('confirmation') !== 'confirm')
			error(400, 'Confirm deployment cancellation.');
		const uuid = event.params.uuid ?? '';
		const current = await readDeployment(uuid);
		if (!['queued', 'in_progress'].includes(String(current.status)))
			error(400, 'Only queued or in-progress deployments can be cancelled.');
		submitted = true;
		await getCoolifyClient().request('POST', `/deployments/${encodeURIComponent(uuid)}/cancel`);
		audit({
			user: event.locals.user.username,
			operation: 'cancel-deployment',
			result: 'success',
			duration_ms: Date.now() - started
		});
		redirect(303, `/deployments/${encodeURIComponent(uuid)}`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
		audit({
			user: event.locals.user?.username,
			operation: 'cancel-deployment',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status, {
			error: isHttpError(caught)
				? caught.body.message
				: 'Cancellation could not be confirmed. The deployment may have finished or changed. Check its current state before retrying.'
		});
	} finally {
		if (submitted) invalidateCollection('deployments');
	}
}
