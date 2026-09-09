import { fail, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { normalizeApplicationTags } from './application-operation-presenter';
import { CoolifyError, type CoolifyRequestOptions } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { applicationDomainFailure } from './resource-actions';
import { serviceDomainSubmission, serviceOperationBody } from './service-operation-presenter';
import { audit, getCoolifyClient } from './runtime';

function path(uuid: string, suffix = '') {
	return `/services/${encodeURIComponent(uuid)}${suffix}`;
}
function status(caught: unknown) {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}
function failure(caught: unknown) {
	const code = status(caught);
	return {
		error: [404, 405, 501].includes(code)
			? 'This operation or resource is unavailable on this Coolify installation.'
			: caught instanceof Error
				? caught.message
				: 'Coolify request failed.'
	};
}
function invalidate() {
	for (const kind of ['services', 'projects', 'resources']) invalidateCollection(kind);
}
async function current(uuid: string) {
	const service = asRecord(await getCoolifyClient().request('GET', path(uuid)));
	if (!service) throw new CoolifyError('Service not found.', 404);
	return service;
}
async function mutate(
	event: RequestEvent,
	method: 'POST' | 'PATCH' | 'DELETE',
	suffix: string,
	options: CoolifyRequestOptions = {}
) {
	const started = Date.now();
	const operation = `${method.toLowerCase()}-service${suffix}`;
	try {
		const result = await getCoolifyClient().request(
			method,
			path(event.params.uuid!, suffix),
			options
		);
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		invalidate();
		return result;
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		throw caught;
	}
}

export async function loadServiceTags(uuid: string) {
	try {
		return {
			tags: normalizeApplicationTags(await getCoolifyClient().request('GET', path(uuid, '/tags')))
		};
	} catch (caught) {
		return { tags: [], requestError: failure(caught).error };
	}
}

export function createServiceDomainActions() {
	return {
		saveDomains: async (event: RequestEvent) => {
			const form = await event.request.formData();
			let submission: ReturnType<typeof serviceDomainSubmission> | undefined;
			try {
				submission = serviceDomainSubmission(form, await current(event.params.uuid!));
				if (!submission.body)
					return fail(400, {
						error: 'Correct the highlighted domains.',
						rows: submission.rows,
						rowErrors: submission.rowErrors
					});
				await mutate(event, 'PATCH', '', { body: submission.body });
				return { message: 'Domains saved', rows: submission.rows };
			} catch (caught) {
				return fail(status(caught), {
					...applicationDomainFailure(caught),
					conflict: status(caught) === 409,
					rows: submission?.rows,
					rowErrors: submission?.rowErrors
				});
			}
		}
	};
}

export function createServiceTagActions() {
	return {
		addTags: async (event: RequestEvent) => {
			const form = await event.request.formData();
			const names = [
				...new Set(
					String(form.get('tag_names') ?? '')
						.split(/[\n,]/)
						.map((name) => name.trim())
						.filter(Boolean)
				)
			];
			if (!names.length || names.some((name) => name.length < 2))
				return fail(400, { error: 'Enter tags of at least two characters.' });
			try {
				await mutate(event, 'POST', '/tags', { body: { tag_names: names } });
				return { message: 'Tags added' };
			} catch (caught) {
				return fail(status(caught), failure(caught));
			}
		},
		deleteTag: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				const tags = normalizeApplicationTags(
					await getCoolifyClient().request('GET', path(event.params.uuid!, '/tags'))
				);
				const tag = tags.find((entry) => entry.uuid === form.get('tag_uuid'));
				if (!tag) return fail(404, { error: 'Tag not found.' });
				if (form.get('confirmation') !== tag.name)
					return fail(400, { error: `Type ${tag.name} exactly to remove this tag.` });
				await mutate(event, 'DELETE', `/tags/${encodeURIComponent(tag.uuid)}`);
				return { message: 'Tag removed' };
			} catch (caught) {
				return fail(status(caught), failure(caught));
			}
		}
	};
}

export function createServiceOperationActions() {
	async function operate(event: RequestEvent, operation: 'clone' | 'move' | 'migrate') {
		const form = await event.request.formData();
		try {
			const name = firstText(await current(event.params.uuid!), ['name']) || event.params.uuid!;
			if (form.get('confirmation') !== `${operation} ${name}`)
				return fail(400, { error: `Type ${operation} ${name} exactly to continue.` });
			let body: Record<string, unknown>;
			try {
				body = serviceOperationBody(operation, form);
			} catch (caught) {
				return fail(400, failure(caught));
			}
			const result = await mutate(event, 'POST', `/${operation}`, { body });
			const clonedUuid = firstText(asRecord(result), ['uuid']);
			if (operation === 'clone' && clonedUuid) redirect(303, path(clonedUuid, '/general'));
			if (operation === 'move') redirect(303, path(event.params.uuid!, '/general'));
			return { message: `Service ${operation} requested` };
		} catch (caught) {
			if (isRedirect(caught)) throw caught;
			return fail(status(caught), failure(caught));
		}
	}
	return {
		cloneService: (event: RequestEvent) => operate(event, 'clone'),
		moveService: (event: RequestEvent) => operate(event, 'move'),
		migrateService: (event: RequestEvent) => operate(event, 'migrate')
	};
}

export function createServiceDangerActions() {
	return {
		deleteService: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				const uuid = event.params.uuid!;
				const name = firstText(await current(uuid), ['name']) || uuid;
				if (form.get('confirmation') !== name && form.get('confirmation') !== uuid)
					return fail(400, { error: `Type ${name} or ${uuid} exactly to delete this service.` });
				const query = Object.fromEntries(
					[
						'delete_configurations',
						'delete_volumes',
						'docker_cleanup',
						'delete_connected_networks'
					].map((key) => [key, form.getAll(key).at(-1) === 'true'])
				);
				await mutate(event, 'DELETE', '', { query });
				redirect(303, '/projects');
			} catch (caught) {
				if (isRedirect(caught)) throw caught;
				return fail(status(caught), failure(caught));
			}
		}
	};
}
