import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';

const request = vi.hoisted(() => vi.fn());
const collectionForPage = vi.hoisted(() => vi.fn());
const collectionSnapshotForPage = vi.hoisted(() =>
	vi.fn(async (...args: unknown[]) => ({
		value: await collectionForPage(...args),
		updatedAt: 1,
		fromCache: true,
		stale: false
	}))
);
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({
	collectionForPage,
	collectionSnapshotForPage,
	invalidateCollection: invalidate
}));

import {
	createS3Storage,
	loadS3Storage,
	loadS3StorageIndex,
	s3StorageActions
} from './s3-storage-pages';
import { s3StorageView } from '$lib/s3-storage-presenter';

const storage = {
	uuid: 's3-1',
	name: 'Primary backups',
	description: 'Production archives',
	endpoint: 'https://s3.example.com',
	bucket: 'production-backups',
	region: 'us-east-1',
	is_usable: true,
	team_id: 1,
	created_at: '2026-09-04T00:00:00Z',
	updated_at: '2026-09-04T00:00:00Z',
	key: 'access-key-secret',
	secret: 'secret-key-secret'
};

function event(values: Record<string, string>, path: string, uuid = 's3-1') {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return {
		params: { uuid },
		locals: { user: { username: 'admin' } },
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

const fields = {
	name: 'Archive storage',
	description: 'Nightly backups',
	endpoint: 'https://s3.created.example.com/',
	bucket: 'nightly-backups',
	region: 'us-west-2',
	key: 'submitted-access-key',
	secret: 'submitted-secret-key'
};

beforeEach(() => {
	request.mockReset();
	collectionForPage.mockReset();
	invalidate.mockReset();
});

test('S3 presenter and cached index expose only explicit non-secret fields', async () => {
	expect(JSON.stringify(s3StorageView(storage))).not.toMatch(/access-key-secret|secret-key-secret/);
	collectionForPage.mockResolvedValue([storage]);
	const result = await loadS3StorageIndex(vi.fn());
	expect(result.storages[0]).toMatchObject({ uuid: 's3-1', isUsable: true });
	expect(JSON.stringify(result)).not.toMatch(/access-key-secret|secret-key-secret/);
});

test('detail requires the exact returned storage identity', async () => {
	request.mockResolvedValueOnce(storage);
	const result = await loadS3Storage('s3-1');
	expect(result.storage.name).toBe('Primary backups');
	expect(result.breadcrumbs).toEqual([
		{ label: 'S3 storage', href: '/storage' },
		{ label: 'Primary backups', href: '/storage/s3-1/general' }
	]);
	expect(JSON.stringify(result)).not.toContain('secret-key-secret');

	request.mockResolvedValueOnce({ ...storage, uuid: 's3-other' });
	await expect(loadS3Storage('s3-1')).rejects.toMatchObject({ status: 404 });
});

test('creation sends one exact allowlist and does not preserve submitted credentials', async () => {
	request.mockResolvedValueOnce({ uuid: 's3-created', secret: 'response-secret' });
	await expect(
		createS3Storage(event({ ...fields, forged: 'ignored' }, '/storage/new', ''))
	).rejects.toMatchObject({ status: 303, location: '/storage/s3-created/general' });
	expect(request).toHaveBeenCalledWith('POST', '/s3-storages', {
		body: {
			name: 'Archive storage',
			description: 'Nightly backups',
			endpoint: 'https://s3.created.example.com',
			bucket: 'nightly-backups',
			region: 'us-west-2',
			key: 'submitted-access-key',
			secret: 'submitted-secret-key',
			is_usable: false
		}
	});
});

test('update keeps blank credentials and marks changed connection settings unvalidated', async () => {
	request.mockResolvedValueOnce(storage).mockResolvedValueOnce({ uuid: 's3-1' });
	const result = await s3StorageActions.update(
		event(
			{
				...fields,
				endpoint: 'https://new-s3.example.com',
				key: '',
				secret: ''
			},
			'/storage/s3-1/general'
		)
	);
	expect(result).toEqual({ message: 'S3 storage settings saved. Validate the connection.' });
	expect(request).toHaveBeenLastCalledWith('PATCH', '/s3-storages/s3-1', {
		body: expect.objectContaining({
			endpoint: 'https://new-s3.example.com',
			is_usable: false
		})
	});
	expect(request.mock.calls.at(-1)?.[2].body).not.toHaveProperty('key');
	expect(request.mock.calls.at(-1)?.[2].body).not.toHaveProperty('secret');
});

test('validation reports a safe result and never relays provider errors', async () => {
	request.mockResolvedValueOnce(storage).mockResolvedValueOnce({ valid: true, message: 'valid' });
	expect(await s3StorageActions.validate(event({}, '/storage/s3-1/general'))).toEqual({
		message: 'S3 storage connection is valid.'
	});

	request.mockReset();
	request
		.mockResolvedValueOnce(storage)
		.mockResolvedValueOnce({ valid: false, message: 'provider credential secret leaked' });
	const failed = await s3StorageActions.validate(event({}, '/storage/s3-1/general'));
	expect(failed).toMatchObject({
		status: 422,
		data: { error: 'S3 connection validation failed. Check the endpoint and credentials.' }
	});
	expect(JSON.stringify(failed)).not.toContain('provider credential secret leaked');
});

test('delete requires an exact name or UUID and maps upstream errors safely', async () => {
	request.mockResolvedValueOnce(storage);
	const missing = await s3StorageActions.delete(
		event({ confirmation: 'wrong' }, '/storage/s3-1/danger')
	);
	expect(missing).toMatchObject({ status: 400 });
	expect(request).toHaveBeenCalledTimes(1);

	request.mockReset();
	request
		.mockResolvedValueOnce(storage)
		.mockRejectedValueOnce(new CoolifyError('provider delete secret', 500));
	const failed = await s3StorageActions.delete(
		event({ confirmation: 'Primary backups' }, '/storage/s3-1/danger')
	);
	expect(failed).toMatchObject({
		status: 500,
		data: { error: 'The S3 storage could not be deleted.' }
	});
	expect(JSON.stringify(failed)).not.toContain('provider delete secret');
});
