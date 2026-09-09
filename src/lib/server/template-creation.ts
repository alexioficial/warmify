import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { loadHierarchy } from './project-actions';
import { configurationSubmission } from './resource-actions';
import type { ConfigurationField } from './resource-groups';
import { audit, getCoolifyClient } from './runtime';

export const templateCreationFields: ConfigurationField[] = [
	{ name: 'type', label: 'Template type', section: 'Template' },
	{ name: 'server_uuid', label: 'Server', section: 'Destination' },
	{ name: 'destination_uuid', label: 'Destination', section: 'Destination' },
	{ name: 'name', label: 'Name', section: 'General' },
	{ name: 'description', label: 'Description', type: 'textarea', section: 'General' },
	{ name: 'tags', label: 'Tags (comma-separated)', section: 'General' },
	{
		name: 'is_container_label_escape_enabled',
		label: 'Escape container labels',
		type: 'checkbox',
		coerce: 'boolean',
		section: 'General'
	},
	{
		name: 'instant_deploy',
		label: 'Deploy immediately',
		type: 'checkbox',
		coerce: 'boolean',
		section: 'Create'
	}
];
const validType = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(value) &&
	!value.includes('..');
export function templateCreationSubmission(form: FormData) {
	const supplied = new FormData();
	for (const field of templateCreationFields) {
		const value = form.getAll(field.name).at(-1);
		if (value != null && String(value).trim()) supplied.set(field.name, value);
	}
	const result = configurationSubmission(supplied, templateCreationFields);
	if (!validType(result.body.type))
		result.fieldErrors.type =
			'Enter a template identifier using letters, numbers, dots, underscores or hyphens.';
	if (!result.body.server_uuid) result.fieldErrors.server_uuid = 'Select a server.';
	if ([...String(result.body.name ?? '')].length > 255)
		result.fieldErrors.name = 'Use at most 255 characters.';
	if (typeof result.body.tags === 'string') {
		const tags = [
			...new Set(
				result.body.tags
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		];
		if (tags.some((tag) => [...tag].length < 2))
			result.fieldErrors.tags = 'Each tag must contain at least two characters.';
		result.body.tags = tags;
	}
	return result;
}
export async function createTemplateResource(event: RequestEvent) {
	let values: Record<string, string | boolean> = {};
	const started = Date.now();
	let submitted = false;
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		if (event.params.kind !== 'service-template') error(404, 'Template route required.');
		const submission = templateCreationSubmission(await event.request.formData());
		values = submission.values;
		if (Object.keys(submission.fieldErrors).length)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values,
				fieldErrors: submission.fieldErrors
			});
		const context = await loadHierarchy(event);
		if (context.kind !== 'environment') error(404, 'Environment required.');
		submitted = true;
		const response = await getCoolifyClient().request('POST', '/services', {
			body: { ...submission.body, project_uuid: event.params.uuid, environment_uuid: context.uuid }
		});
		for (const group of ['services', 'resources', 'projects']) invalidateCollection(group);
		audit({
			user: event.locals.user.username,
			operation: 'create-service-template',
			result: 'success',
			duration_ms: Date.now() - started
		});
		const uuid = firstText(asRecord(response), ['uuid']);
		redirect(303, uuid ? `/services/${encodeURIComponent(uuid)}/general` : context.href);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
		const details = caught instanceof CoolifyError ? asRecord(caught.details) : undefined;
		const errors = asRecord(details?.errors);
		const fieldErrors = Object.fromEntries(
			templateCreationFields
				.filter((field) => errors && field.name in errors)
				.map((field) => [field.name, 'Coolify rejected this value.'])
		);
		// Only use type hints returned from the user's actual creation attempt, never probe with POST.
		const suggestedTypes =
			submitted && status === 404 && Array.isArray(details?.valid_service_types)
				? [...new Set(details.valid_service_types.filter(validType))]
				: [];
		const message = isHttpError(caught)
			? caught.body.message
			: status === 404
				? 'Template, project, environment or server was not found. Check the template identifier and destination.'
				: status === 422 || status === 400
					? 'Coolify rejected the template configuration. Review the highlighted fields.'
					: 'Creation could not be completed. Check the environment before retrying.';
		audit({
			user: event.locals.user?.username,
			operation: 'create-service-template',
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status, { error: message, values, fieldErrors, suggestedTypes });
	}
}
