import { fail, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { databaseEngines, databaseFields } from './database-presenter';
import { configurationSubmission, configurationFailure } from './resource-actions';
import type { ConfigurationField } from './resource-groups';
import { databaseFailure } from './database-pages';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

export function databaseCreationFields(engine: string): ConfigurationField[] {
	if (!databaseEngines.some((value) => value === engine)) return [];
	return [
		...databaseFields(engine)
			.filter((field) => field.section !== 'healthcheck')
			.map((field) => ({
				...field,
				...(field.name === 'public_port' ? { min: 1024 } : {}),
				...(field.name === 'instant_deploy' ? { label: 'Deploy immediately' } : {})
			})),
		{ name: 'server_uuid', label: 'Server', section: 'destination' },
		{ name: 'destination_uuid', label: 'Destination', section: 'destination' },
		{ name: 'tags', label: 'Tags (comma-separated)', section: 'general' }
	];
}
export function databaseCreationSubmission(form: FormData, engine: string) {
	const fields = databaseCreationFields(engine);
	// Unlike PATCH, empty creation inputs must not override generated/default values.
	const supplied = new FormData();
	for (const field of fields) {
		const value = form.getAll(field.name).at(-1);
		if (value != null && String(value).trim() !== '') supplied.set(field.name, value);
	}
	const result = configurationSubmission(supplied, fields);
	if (!fields.length) result.fieldErrors.engine = 'Unsupported database engine.';
	if (!result.body.server_uuid) result.fieldErrors.server_uuid = 'Select a server.';
	if (result.body.is_public === true && !result.body.public_port)
		result.fieldErrors.public_port = 'A public port is required to expose this database.';
	if (String(result.body.name ?? '').length > 255)
		result.fieldErrors.name = 'Use at most 255 characters.';
	if (typeof result.body.tags === 'string') {
		const tags = [
			...new Set(
				result.body.tags
					.split(/[\n,]/)
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		];
		if (tags.some((tag) => tag.length < 2))
			result.fieldErrors.tags = 'Each tag must contain at least two characters.';
		result.body.tags = tags;
	}
	return result;
}
export async function createDatabase(event: RequestEvent) {
	const engine = event.params.kind!;
	const submission = databaseCreationSubmission(await event.request.formData(), engine);
	const { values, fieldErrors } = submission;
	if (Object.keys(fieldErrors).length)
		return fail(400, { error: 'Correct the highlighted fields.', values, fieldErrors });
	const started = Date.now();
	try {
		const environment = asRecord(
			await getCoolifyClient().request(
				'GET',
				`/projects/${encodeURIComponent(event.params.uuid!)}/${encodeURIComponent(event.params.environment!)}`
			)
		);
		if (!environment || environment.uuid !== event.params.environment)
			return fail(404, {
				error: 'Environment not found in this project.',
				values,
				fieldErrors: {}
			});
		const result = await getCoolifyClient().request('POST', `/databases/${engine}`, {
			body: {
				...submission.body,
				project_uuid: event.params.uuid,
				environment_uuid: environment.uuid
			}
		});
		for (const group of ['databases', 'projects', 'resources']) invalidateCollection(group);
		audit({
			user: event.locals.user?.username,
			operation: `create-database-${engine}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		const uuid = firstText(asRecord(result), ['uuid']);
		redirect(
			303,
			uuid
				? `/databases/${encodeURIComponent(uuid)}/general`
				: `/projects/${encodeURIComponent(event.params.uuid!)}/environments/${encodeURIComponent(event.params.environment!)}`
		);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		audit({
			user: event.locals.user?.username,
			operation: `create-database-${engine}`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(databaseFailure(caught).status, {
			...configurationFailure(caught, databaseCreationFields(engine), submission.sensitiveValues),
			values
		});
	}
}
