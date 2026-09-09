import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

export interface DeploymentDraft {
	mode: string;
	targets: string;
	force: boolean;
	pull_request_id: string;
	docker_tag: string;
}
export interface DeploymentOutcome {
	resourceUuid: string;
	deploymentUuid: string;
	outcome: 'reference' | 'started' | 'skipped' | 'rejected' | 'unconfirmed' | 'missing';
}
const identifier = /^[A-Za-z0-9_-]{1,255}$/;

export function deploymentSubmission(form: FormData) {
	const forceValue = String(form.getAll('force').at(-1) ?? '');
	const values: DeploymentDraft = {
		mode: String(form.get('mode') ?? 'uuid'),
		targets: String(form.get('targets') ?? '').trim(),
		force: forceValue === 'true',
		pull_request_id: String(form.get('pull_request_id') ?? '').trim(),
		docker_tag: String(form.get('docker_tag') ?? '').trim()
	};
	const targets = [
		...new Set(
			values.targets
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean)
		)
	];
	const fieldErrors: Record<string, string> = {};
	const body: Record<string, string | number | boolean> = {};
	if (!['uuid', 'tag'].includes(values.mode)) fieldErrors.mode = 'Select UUIDs or tags.';
	if (
		!targets.length ||
		targets.some((value) =>
			values.mode === 'uuid'
				? !identifier.test(value)
				: value.length > 255 ||
					[...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
		)
	)
		fieldErrors.targets = 'Enter comma-separated resource UUIDs or valid tag names.';
	if (forceValue && !['true', 'false'].includes(forceValue))
		fieldErrors.force = 'Choose whether to force a rebuild.';
	if (['uuid', 'tag'].includes(values.mode)) body[values.mode] = targets.join(',');
	if (forceValue) body.force = values.force;
	if (values.pull_request_id) {
		const preview = Number(values.pull_request_id);
		if (
			values.mode !== 'uuid' ||
			!/^\d+$/.test(values.pull_request_id) ||
			!Number.isSafeInteger(preview) ||
			preview <= 0
		)
			fieldErrors.pull_request_id = 'Use a positive preview ID with UUID selection only.';
		else body.pull_request_id = preview;
	}
	if (values.docker_tag) {
		if (
			values.mode !== 'uuid' ||
			!body.pull_request_id ||
			!/^[\w][\w.-]{0,127}$/.test(values.docker_tag)
		)
			fieldErrors.docker_tag =
				'Use a valid Docker image tag with a positive preview ID and UUID selection.';
		else body.docker_tag = values.docker_tag;
	}
	return { values, targets, body, fieldErrors };
}

export function deploymentOutcomes(
	response: unknown,
	requested: string[] = []
): DeploymentOutcome[] {
	const record = asRecord(response);
	const rows = normalizeRecords(record?.deployments ?? record?.details);
	const result: DeploymentOutcome[] = [];
	for (const row of rows) {
		const resourceUuid = firstText(row, ['resource_uuid']);
		const deploymentUuid = firstText(row, ['deployment_uuid']);
		if (!identifier.test(resourceUuid)) continue;
		const message = firstText(row, ['message']);
		const outcome =
			/^(?:Unauthorized to |Pull request \d+ not found|docker_tag can only|Resource \(.+\) not found)/i.test(
				message
			)
				? 'rejected'
				: /^Deployment (?:skipped\b|already queued for this commit\.)/i.test(message)
					? 'skipped'
					: identifier.test(deploymentUuid)
						? 'reference'
						: /^(?:Service|Database) .+ started\./.test(message)
							? 'started'
							: 'unconfirmed';
		result.push({
			resourceUuid,
			deploymentUuid: outcome === 'reference' ? deploymentUuid : '',
			outcome
		});
	}
	for (const resourceUuid of requested)
		if (!result.some((row) => row.resourceUuid === resourceUuid))
			result.push({ resourceUuid, deploymentUuid: '', outcome: 'missing' });
	return result;
}

export async function deployResources(event: RequestEvent) {
	const started = Date.now();
	let values: DeploymentDraft | undefined;
	let submitted = false;
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		const form = await event.request.formData();
		const submission = deploymentSubmission(form);
		values = submission.values;
		if (Object.keys(submission.fieldErrors).length)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values,
				fieldErrors: submission.fieldErrors
			});
		if (form.get('confirmation') !== 'confirm')
			error(400, 'Confirm that the selected resources may be deployed or started.');
		submitted = true;
		const response = await getCoolifyClient().request('POST', '/deploy', { body: submission.body });
		audit({
			user: event.locals.user.username,
			operation: 'deploy-resources',
			result: 'response-received',
			duration_ms: Date.now() - started
		});
		return {
			message: 'Coolify processed the request. Review the results and current resource state.',
			values,
			outcomes: deploymentOutcomes(response, values.mode === 'uuid' ? submission.targets : []),
			tagRequest: values.mode === 'tag'
		};
	} catch (caught) {
		const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
		audit({
			user: event.locals.user?.username,
			operation: 'deploy-resources',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status, {
			error: isHttpError(caught)
				? caught.body.message
				: 'Coolify could not confirm the complete deployment request.',
			values,
			uncertain: submitted,
			...(caught instanceof CoolifyError && caught.retryAfterSeconds
				? { retryAfterSeconds: caught.retryAfterSeconds }
				: {})
		});
	} finally {
		// A timeout/429 may occur after earlier targets have already started.
		if (submitted)
			for (const group of ['deployments', 'applications', 'services', 'databases', 'resources'])
				invalidateCollection(group);
	}
}
