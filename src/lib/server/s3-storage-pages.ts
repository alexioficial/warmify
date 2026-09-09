import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { s3StorageCollection, s3StorageView, type S3StorageView } from '$lib/s3-storage-presenter';
import { CoolifyError } from './coolify-client';
import { collectionSnapshotForPage, invalidateCollection } from './inventory-cache';
import { audit, getCoolifyClient } from './runtime';

const NAME_PATTERN = /^[\p{L}\p{M}\p{N}\s\-_.@/&()#,:+]+$/u;
const DESCRIPTION_PATTERN = /^[\p{L}\p{M}\p{N}\s\-_.,!?()'"+=*@/&]+$/u;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function validUuid(value: string) {
	return /^[A-Za-z0-9_-]{1,255}$/.test(value);
}

function parseUuid(value: string | undefined) {
	if (!value || !validUuid(value)) error(404, 'S3 storage not found.');
	return value;
}

function text(form: FormData, name: string) {
	return String(form.get(name) ?? '').trim();
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

function safeStatus(caught: unknown) {
	const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return status >= 400 && status <= 599 ? status : 500;
}

function safeError(caught: unknown, operation: 'create' | 'update' | 'delete' | 'validate') {
	if (isHttpError(caught)) return caught.body.message;
	if (operation === 'validate')
		return 'S3 connection validation failed. Check the endpoint and credentials.';
	return `The S3 storage could not be ${operation === 'create' ? 'created' : operation === 'update' ? 'updated' : 'deleted'}.`;
}

function normalizedEndpoint(value: string) {
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
			error(400, 'Enter a valid HTTP or HTTPS S3 endpoint without embedded credentials.');
		return url.toString().replace(/\/$/, '');
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(400, 'Enter a valid HTTP or HTTPS S3 endpoint.');
	}
}

function validBucket(value: string) {
	return (
		BUCKET_PATTERN.test(value) &&
		!value.includes('..') &&
		!value.includes('.-') &&
		!value.includes('-.') &&
		!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)
	);
}

function submission(form: FormData, creating: boolean, current?: S3StorageView) {
	const name = text(form, 'name');
	const description = text(form, 'description');
	const endpoint = normalizedEndpoint(text(form, 'endpoint'));
	const bucket = text(form, 'bucket');
	const region = text(form, 'region');
	const key = text(form, 'key');
	const secret = text(form, 'secret');
	if (name.length < 3 || name.length > 255 || !NAME_PATTERN.test(name))
		error(400, 'Enter a valid storage name between 3 and 255 characters.');
	if (description.length > 255 || (description && !DESCRIPTION_PATTERN.test(description)))
		error(400, 'Enter a valid description no longer than 255 characters.');
	if (!validBucket(bucket)) error(400, 'Enter a valid S3 bucket name.');
	if (!region || region.length > 255) error(400, 'Enter a valid S3 region.');
	if (key.length > 255 || secret.length > 255 || (creating && (!key || !secret)))
		error(400, 'Access and secret keys are required and must be 255 characters or fewer.');

	const connectionChanged =
		creating ||
		!current ||
		endpoint !== current.endpoint ||
		bucket !== current.bucket ||
		region !== current.region ||
		Boolean(key || secret);
	return {
		body: {
			name,
			description: description || null,
			endpoint,
			bucket,
			region,
			...(key ? { key } : {}),
			...(secret ? { secret } : {}),
			...(connectionChanged ? { is_usable: false } : {})
		},
		values: { name, description, endpoint, bucket, region }
	};
}

async function readStorage(uuidValue: string | undefined) {
	const uuid = parseUuid(uuidValue);
	const storage = s3StorageView(
		await getCoolifyClient().request('GET', `/s3-storages/${encodeURIComponent(uuid)}`)
	);
	if (!storage || storage.uuid !== uuid) error(404, 'S3 storage not found.');
	return storage;
}

export async function loadS3StorageIndex(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		const snapshot = await collectionSnapshotForPage('storage');
		return {
			storages: s3StorageCollection(snapshot.value),
			sync: {
				updatedAt: snapshot.updatedAt,
				fromCache: snapshot.fromCache,
				stale: snapshot.stale
			},
			requestError: ''
		};
	} catch {
		return {
			storages: [] as S3StorageView[],
			sync: null,
			requestError: 'S3 storage could not be loaded.'
		};
	}
}

export async function loadS3Storage(uuidValue: string | undefined) {
	try {
		const storage = await readStorage(uuidValue);
		return {
			uuid: storage.uuid,
			storage,
			breadcrumbs: [
				{ label: 'S3 storage', href: '/storage' },
				{ label: storage.name, href: `/storage/${storage.uuid}/general` }
			]
		};
	} catch (caught) {
		if (isHttpError(caught)) throw caught;
		error(
			caught instanceof CoolifyError && caught.status === 404 ? 404 : 502,
			'S3 storage could not be loaded.'
		);
	}
}

function auditResult(
	event: RequestEvent,
	operation: string,
	result: 'success' | 'error',
	start: number
) {
	audit({
		user: event.locals.user?.username,
		operation,
		result,
		duration_ms: Date.now() - start
	});
}

export async function createS3Storage(event: RequestEvent) {
	const start = Date.now();
	let values: Record<string, unknown> = {};
	try {
		assertMutation(event);
		const prepared = submission(await event.request.formData(), true);
		values = prepared.values;
		const response = asRecord(
			await getCoolifyClient().request('POST', '/s3-storages', { body: prepared.body })
		);
		const uuid = firstText(response, ['uuid']);
		if (!validUuid(uuid)) error(502, 'Coolify did not return the created storage identity.');
		invalidateCollection('storage');
		auditResult(event, 'create-s3-storage', 'success', start);
		redirect(303, `/storage/${encodeURIComponent(uuid)}/general`);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, 'create-s3-storage', 'error', start);
		return fail(safeStatus(caught), { error: safeError(caught, 'create'), values });
	}
}

async function storageMutation(
	event: RequestEvent,
	operation: 'update' | 'delete' | 'validate',
	callback: (storage: S3StorageView, form: FormData) => Promise<{ message: string }>
) {
	const start = Date.now();
	try {
		assertMutation(event);
		const storage = await readStorage(event.params.uuid);
		const result = await callback(storage, await event.request.formData());
		auditResult(event, `${operation}-s3-storage`, 'success', start);
		return result;
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		auditResult(event, `${operation}-s3-storage`, 'error', start);
		return fail(safeStatus(caught), { error: safeError(caught, operation) });
	}
}

export const s3StorageActions = {
	update: (event: RequestEvent) =>
		storageMutation(event, 'update', async (storage, form) => {
			const prepared = submission(form, false, storage);
			await getCoolifyClient().request(
				'PATCH',
				`/s3-storages/${encodeURIComponent(storage.uuid)}`,
				{ body: prepared.body }
			);
			invalidateCollection('storage');
			return {
				message:
					'is_usable' in prepared.body
						? 'S3 storage settings saved. Validate the connection.'
						: 'S3 storage settings saved.'
			};
		}),
	validate: (event: RequestEvent) =>
		storageMutation(event, 'validate', async (storage) => {
			const response = asRecord(
				await getCoolifyClient().request(
					'POST',
					`/s3-storages/${encodeURIComponent(storage.uuid)}/validate`
				)
			);
			invalidateCollection('storage');
			if (response?.valid !== true)
				error(422, 'S3 connection validation failed. Check the endpoint and credentials.');
			return { message: 'S3 storage connection is valid.' };
		}),
	delete: (event: RequestEvent) =>
		storageMutation(event, 'delete', async (storage, form) => {
			const confirmation = text(form, 'confirmation');
			if (confirmation !== storage.name && confirmation !== storage.uuid)
				error(400, 'Type the storage name or UUID exactly to confirm deletion.');
			await getCoolifyClient().request(
				'DELETE',
				`/s3-storages/${encodeURIComponent(storage.uuid)}`
			);
			invalidateCollection('storage');
			redirect(303, '/storage');
		})
};
