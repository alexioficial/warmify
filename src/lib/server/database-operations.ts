import { fail, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText } from '../resource-presenter';
import { normalizeApplicationTags } from './application-operation-presenter';
import { serviceOperationBody } from './service-operation-presenter';
import { databaseFailure } from './database-pages';
import { CoolifyError, type CoolifyRequestOptions } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const path = (uuid: string, suffix = '') => `/databases/${encodeURIComponent(uuid)}${suffix}`;
async function currentName(uuid: string) {
	const row = asRecord(await getCoolifyClient().request('GET', path(uuid)));
	if (!row) throw new CoolifyError('Database not found.', 404);
	return firstText(row, ['name']) || uuid;
}
function failure(caught: unknown) {
	const result = databaseFailure(caught);
	return fail(result.status, { error: result.error });
}
async function mutate(
	event: RequestEvent,
	method: 'POST' | 'DELETE',
	suffix: string,
	options: CoolifyRequestOptions = {}
) {
	const started = Date.now();
	const operation = `${method.toLowerCase()}-database${suffix}`;
	try {
		const result = await getCoolifyClient().request(
			method,
			path(event.params.uuid!, suffix),
			options
		);
		for (const group of ['databases', 'projects', 'resources']) invalidateCollection(group);
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
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
export async function loadDatabaseTags(uuid: string) {
	try {
		return {
			tags: normalizeApplicationTags(await getCoolifyClient().request('GET', path(uuid, '/tags')))
		};
	} catch (caught) {
		return { tags: [], requestError: databaseFailure(caught).error };
	}
}
export function createDatabaseTagActions() {
	return {
		addTags: async (event: RequestEvent) => {
			const form = await event.request.formData();
			const tagNames = String(form.get('tag_names') ?? '');
			const names = [
				...new Set(
					tagNames
						.split(/[\n,]/)
						.map((name) => name.trim())
						.filter(Boolean)
				)
			];
			if (!names.length || names.some((name) => name.length < 2))
				return fail(400, { error: 'Enter tags of at least two characters.', tagNames });
			try {
				await mutate(event, 'POST', '/tags', { body: { tag_names: names } });
				return { message: 'Tags added', tagNames: '' };
			} catch (caught) {
				const result = databaseFailure(caught);
				return fail(result.status, { error: result.error, tagNames });
			}
		},
		deleteTag: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				const tags = normalizeApplicationTags(
					await getCoolifyClient().request('GET', path(event.params.uuid!, '/tags'))
				);
				const tag = tags.find((row) => row.uuid === form.get('tag_uuid'));
				if (!tag) return fail(404, { error: 'Tag not found in this database.' });
				if (form.get('confirmation') !== tag.name)
					return fail(400, { error: `Type ${tag.name} exactly to remove this tag.` });
				await mutate(event, 'DELETE', `/tags/${encodeURIComponent(tag.uuid)}`);
				return { message: 'Tag removed' };
			} catch (caught) {
				return failure(caught);
			}
		}
	};
}
export function createDatabaseOperationActions() {
	async function operate(event: RequestEvent, operation: 'clone' | 'move' | 'migrate') {
		const form = await event.request.formData();
		try {
			const name = await currentName(event.params.uuid!);
			if (form.get('confirmation') !== `${operation} ${name}`)
				return fail(400, { error: `Type ${operation} ${name} exactly to continue.` });
			let body: Record<string, unknown>;
			try {
				// The pinned database and service controllers share these exact operation contracts.
				body = serviceOperationBody(operation, form);
				if (operation === 'clone' && String(body.name ?? '').length > 255)
					throw new Error('Use a name of at most 255 characters.');
			} catch (caught) {
				return fail(400, {
					error: caught instanceof Error ? caught.message : 'Invalid operation.'
				});
			}
			const result = await mutate(event, 'POST', `/${operation}`, { body });
			const clonedUuid = firstText(asRecord(result), ['uuid']);
			if (operation === 'clone' && clonedUuid) redirect(303, path(clonedUuid, '/general'));
			if (operation === 'move') redirect(303, path(event.params.uuid!, '/general'));
			return {
				message:
					operation === 'migrate'
						? 'Database migration requested. Start the database after migration completes.'
						: 'Database clone requested'
			};
		} catch (caught) {
			if (isRedirect(caught)) throw caught;
			return failure(caught);
		}
	}
	return {
		cloneDatabase: (event: RequestEvent) => operate(event, 'clone'),
		moveDatabase: (event: RequestEvent) => operate(event, 'move'),
		migrateDatabase: (event: RequestEvent) => operate(event, 'migrate')
	};
}
export function createDatabaseDangerActions() {
	return {
		deleteDatabase: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				const uuid = event.params.uuid!;
				const name = await currentName(uuid);
				if (form.get('confirmation') !== name && form.get('confirmation') !== uuid)
					return fail(400, { error: `Type ${name} or ${uuid} exactly to delete this database.` });
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
				return failure(caught);
			}
		}
	};
}
