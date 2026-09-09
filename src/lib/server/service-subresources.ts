import { fail, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText } from '../resource-presenter';

import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { configurationFailure, configurationSubmission } from './resource-actions';
import type { ConfigurationField } from './resource-groups';
import { redactSecrets } from './redact';
import { audit, getCoolifyClient } from './runtime';

export type ServiceSubresourceKind = 'applications' | 'databases';

export const serviceApplicationFields: readonly ConfigurationField[] = [
	{ name: 'human_name', label: 'Display name', section: 'configuration', nullable: true },
	{
		name: 'description',
		label: 'Description',
		type: 'textarea',
		section: 'configuration',
		nullable: true
	},
	{ name: 'image', label: 'Container image', section: 'configuration', nullable: true },
	{ name: 'url', label: 'Public URLs', type: 'textarea', section: 'configuration', nullable: true },
	{
		name: 'noindex_domains',
		label: 'No-index domains (JSON array)',
		type: 'textarea',
		section: 'configuration',
		coerce: 'json',
		nullable: true
	},
	{
		name: 'exclude_from_status',
		label: 'Exclude from service status',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_log_drain_enabled',
		label: 'Send logs to the server log drain',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_gzip_enabled',
		label: 'Enable gzip',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_stripprefix_enabled',
		label: 'Strip path prefix',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_force_https_enabled',
		label: 'Force HTTPS',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	}
];

export const serviceDatabaseFields: readonly ConfigurationField[] = [
	{ name: 'human_name', label: 'Display name', section: 'configuration', nullable: true },
	{
		name: 'description',
		label: 'Description',
		type: 'textarea',
		section: 'configuration',
		nullable: true
	},
	{ name: 'image', label: 'Container image', section: 'configuration' },
	{
		name: 'exclude_from_status',
		label: 'Exclude from service status',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_log_drain_enabled',
		label: 'Send logs to the server log drain',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'is_public',
		label: 'Expose publicly',
		type: 'checkbox',
		section: 'configuration',
		coerce: 'boolean'
	},
	{
		name: 'public_port',
		label: 'Public port',
		type: 'number',
		section: 'configuration',
		coerce: 'integer',
		nullable: true,
		min: 1,
		max: 65535
	},
	{
		name: 'public_port_timeout',
		label: 'Public port timeout',
		type: 'number',
		section: 'configuration',
		coerce: 'integer',
		nullable: true,
		min: 1
	}
];

function requestStatus(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

function identifiers(event: RequestEvent, kind: ServiceSubresourceKind) {
	const serviceUuid = event.params.uuid;
	const resourceUuid = kind === 'applications' ? event.params.application : event.params.database;
	if (!serviceUuid || !resourceUuid)
		throw new CoolifyError('Resource identifier is required.', 400);
	return { serviceUuid, resourceUuid };
}

function path(
	serviceUuid: string,
	kind: ServiceSubresourceKind,
	resourceUuid: string,
	suffix = ''
) {
	return `/services/${encodeURIComponent(serviceUuid)}/${kind}/${encodeURIComponent(resourceUuid)}${suffix}`;
}

function fields(kind: ServiceSubresourceKind): readonly ConfigurationField[] {
	return kind === 'applications' ? serviceApplicationFields : serviceDatabaseFields;
}

function invalidateServiceViews(): void {
	for (const collection of ['services', 'resources', 'projects']) invalidateCollection(collection);
}

export async function loadServiceSubresource(
	serviceUuid: string,
	kind: ServiceSubresourceKind,
	resourceUuid: string
) {
	try {
		const resource = asRecord(
			redactSecrets(await getCoolifyClient().request('GET', path(serviceUuid, kind, resourceUuid)))
		);
		if (!resource) throw new Error('Service resource not found');
		return {
			resource,
			resourceName: firstText(resource, ['human_name', 'name']) || resourceUuid,
			resourceUuid,
			kind,
			configurationFields: fields(kind)
		};
	} catch (caught) {
		return {
			resource: null,
			resourceName: resourceUuid,
			resourceUuid,
			kind,
			configurationFields: fields(kind),
			requestError: caught instanceof Error ? caught.message : 'Coolify request failed.'
		};
	}
}

export function createServiceSubresourceActions(kind: ServiceSubresourceKind) {
	return {
		save: async (event: RequestEvent) => {
			const { serviceUuid, resourceUuid } = identifiers(event, kind);
			const allowedFields = fields(kind);
			const submission = configurationSubmission(await event.request.formData(), allowedFields);
			if (
				kind === 'applications' &&
				'noindex_domains' in submission.body &&
				submission.body.noindex_domains !== null &&
				(!Array.isArray(submission.body.noindex_domains) ||
					submission.body.noindex_domains.some((value) => typeof value !== 'string'))
			) {
				submission.fieldErrors.noindex_domains = 'Enter a JSON array of domain names.';
				delete submission.body.noindex_domains;
			}
			if (Object.keys(submission.fieldErrors).length)
				return fail(400, {
					error: 'Correct the highlighted fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					section: 'configuration'
				});
			if (!Object.keys(submission.body).length)
				return fail(400, {
					error: 'No editable fields found.',
					values: submission.values,
					section: 'configuration'
				});
			const started = Date.now();
			try {
				await getCoolifyClient().request('PATCH', path(serviceUuid, kind, resourceUuid), {
					body: submission.body
				});
				audit({
					user: event.locals.user?.username,
					operation: `update-service-${kind === 'applications' ? 'application' : 'database'}`,
					result: 'success',
					duration_ms: Date.now() - started
				});
				invalidateServiceViews();
				return {
					message: 'Configuration saved',
					values: submission.values,
					section: 'configuration'
				};
			} catch (caught) {
				audit({
					user: event.locals.user?.username,
					operation: `update-service-${kind === 'applications' ? 'application' : 'database'}`,
					result: 'error',
					duration_ms: Date.now() - started
				});
				return fail(requestStatus(caught), {
					...configurationFailure(caught, allowedFields, submission.sensitiveValues),
					values: submission.values,
					section: 'configuration'
				});
			}
		},

		lifecycle: async (event: RequestEvent) => {
			const { serviceUuid, resourceUuid } = identifiers(event, kind);
			const form = await event.request.formData();
			const action = String(form.get('action') ?? '');
			if (!['start', 'restart', 'stop'].includes(action))
				return fail(400, { error: 'Action is not available.' });
			if (['restart', 'stop'].includes(action) && form.get('confirmation') !== 'confirm')
				return fail(400, { error: 'Confirmation is required.' });
			const started = Date.now();
			const operation = `${action}-service-${kind === 'applications' ? 'application' : 'database'}`;
			try {
				const response = asRecord(
					await getCoolifyClient().request(
						'POST',
						path(serviceUuid, kind, resourceUuid, `/${action}`)
					)
				);
				audit({
					user: event.locals.user?.username,
					operation,
					result: 'success',
					duration_ms: Date.now() - started
				});
				invalidateServiceViews();
				return {
					message:
						firstText(response, ['message']) ||
						`${action.charAt(0).toUpperCase()}${action.slice(1)} requested`
				};
			} catch (caught) {
				audit({
					user: event.locals.user?.username,
					operation,
					result: 'error',
					duration_ms: Date.now() - started
				});
				return fail(requestStatus(caught), {
					error: [404, 405, 501].includes(requestStatus(caught))
						? 'This operation or resource is unavailable on this Coolify installation.'
						: caught instanceof Error
							? caught.message
							: 'Coolify request failed.'
				});
			}
		}
	};
}
