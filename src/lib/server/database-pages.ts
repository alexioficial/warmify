import { fail, type RequestEvent } from '@sveltejs/kit';
import { applicationHierarchy, asRecord, firstText } from '../resource-presenter';
import {
	databaseEngine,
	databaseFields,
	databaseOverview,
	databaseSubmission
} from './database-presenter';
import { configurationFailure } from './resource-actions';
import { collectionForPage, invalidateCollection } from './inventory-cache';
import { redactSecrets } from './redact';
import { audit, getCoolifyClient } from './runtime';
import { CoolifyError } from './coolify-client';

export function databaseFailure(caught: unknown) {
	const status = caught instanceof CoolifyError ? caught.status : 500;
	return {
		status,
		error: [404, 405, 501].includes(status)
			? 'This resource or operation is unavailable on this Coolify installation.'
			: caught instanceof Error
				? caught.message
				: 'Coolify request failed.'
	};
}
export async function loadDatabase(uuid: string) {
	try {
		const [result, projects] = await Promise.all([
			getCoolifyClient().request('GET', `/databases/${encodeURIComponent(uuid)}`),
			collectionForPage('projects').catch(() => [])
		]);
		const database = asRecord(redactSecrets(result));
		if (!database) throw new CoolifyError('Database not found.', 404);
		const databaseName = firstText(database, ['name']) || 'Database';
		const hierarchy = applicationHierarchy(database, projects);
		return {
			uuid,
			database,
			databaseName,
			overview: databaseOverview(database),
			configurationFields: databaseFields(databaseEngine(database)),
			breadcrumbs: [
				{ label: 'Projects', href: '/projects' },
				...(hierarchy
					? [
							{
								label: hierarchy.projectName,
								href: `/projects/${encodeURIComponent(hierarchy.projectUuid)}`
							},
							{
								label: hierarchy.environmentName,
								href: `/projects/${encodeURIComponent(hierarchy.projectUuid)}/environments/${encodeURIComponent(hierarchy.environmentUuid)}`
							}
						]
					: []),
				{ label: databaseName, href: `/databases/${encodeURIComponent(uuid)}/general` }
			]
		};
	} catch (caught) {
		return {
			uuid,
			database: null,
			databaseName: 'Database',
			configurationFields: [],
			requestError: databaseFailure(caught).error,
			breadcrumbs: [{ label: 'Projects', href: '/projects' }]
		};
	}
}
export function createDatabaseConfigurationActions(section: string) {
	return {
		save: async (event: RequestEvent) => {
			let submission: ReturnType<typeof databaseSubmission> | undefined;
			let fields: ReturnType<typeof databaseFields> = [];
			const started = Date.now();
			try {
				const path = `/databases/${encodeURIComponent(event.params.uuid!)}`;
				const current = await getCoolifyClient().request('GET', path);
				const engine = databaseEngine(current);
				fields = databaseFields(engine).filter((field) => field.section === section);
				submission = databaseSubmission(await event.request.formData(), engine, section);
				if (Object.keys(submission.fieldErrors).length)
					return fail(400, {
						error: 'Correct the highlighted fields.',
						fieldErrors: submission.fieldErrors,
						values: submission.values,
						section
					});
				if (!Object.keys(submission.body).length)
					return fail(400, { error: 'No editable values submitted.', section });
				await getCoolifyClient().request('PATCH', path, { body: submission.body });
				for (const group of ['databases', 'projects', 'resources']) invalidateCollection(group);
				audit({
					user: event.locals.user?.username,
					operation: `update-database-${section}`,
					result: 'success',
					duration_ms: Date.now() - started
				});
				return { message: 'Configuration saved', values: submission.values, section };
			} catch (caught) {
				audit({
					user: event.locals.user?.username,
					operation: `update-database-${section}`,
					result: 'error',
					duration_ms: Date.now() - started
				});
				return fail(databaseFailure(caught).status, {
					...configurationFailure(caught, fields, submission?.sensitiveValues ?? []),
					values: submission?.values,
					section
				});
			}
		}
	};
}
