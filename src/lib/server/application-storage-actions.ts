import { fail, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords, type ResourceRecord } from '../resource-presenter';

import { CoolifyError } from './coolify-client';

export type ApplicationStorageKind = 'persistent' | 'file' | 'directory' | 'host-file';
export type ApplicationStorageType = 'persistent' | 'file';
export type StorageResourceKind = 'applications' | 'services' | 'databases';

export interface ApplicationStorageSummary {
	id: string;
	type: ApplicationStorageType;
	kind: ApplicationStorageKind;
	label: string;
	name: string;
	mountPath: string;
	source: string;
	hostPath: string;
	fsPath: string;
	previewSuffixEnabled: boolean;
	readOnly: boolean;
	backupEligible: boolean;
	backupState: 'enabled' | 'disabled' | 'unknown';
}

export interface S3StorageOption {
	uuid: string;
	name: string;
}

export interface ApplicationStorageFailure {
	error: string;
	fieldErrors: Record<string, string>;
	retryAfterSeconds?: number;
}

interface StorageSubmission<TBody> {
	body?: TBody;
	values: Record<string, string | boolean | number>;
	fieldErrors: Record<string, string>;
	sensitiveValues: string[];
}

export interface ApplicationBackupScheduleBody {
	frequency: string;
	enabled: boolean;
	save_s3: boolean;
	disable_local_backup: boolean;
	stop_during_backup: boolean;
	s3_storage_uuid: string | null;
	retention_amount_locally: number;
	retention_days_locally: number;
	retention_max_storage_locally: number;
	retention_amount_s3: number;
	retention_days_s3: number;
	retention_max_storage_s3: number;
	timeout: number;
}

interface PersistentStorageCreateBody {
	type: 'persistent';
	name: string;
	mount_path: string;
	host_path?: string;
}

interface FileStorageCreateBody {
	type: 'file';
	mount_path: string;
	content?: string;
	is_directory?: true;
	is_host_file?: true;
	fs_path?: string;
}

type ApplicationStorageCreateBody = PersistentStorageCreateBody | FileStorageCreateBody;

interface ApplicationStorageUpdateBody {
	uuid: string;
	type: ApplicationStorageType;
	is_preview_suffix_enabled: boolean;
	name?: string;
	mount_path?: string;
	host_path?: string | null;
	content?: string;
}

const STORAGE_FIELDS = new Set([
	'type',
	'name',
	'mount_path',
	'host_path',
	'content',
	'is_directory',
	'is_host_file',
	'fs_path',
	'is_preview_suffix_enabled',
	'frequency',
	'enabled',
	'save_s3',
	'disable_local_backup',
	'stop_during_backup',
	's3_storage_uuid',
	'retention_amount_locally',
	'retention_days_locally',
	'retention_max_storage_locally',
	'retention_amount_s3',
	'retention_days_s3',
	'retention_max_storage_s3',
	'timeout'
]);
const VOLUME_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DIRECTORY_PATH_PATTERN = /^\/[A-Za-z0-9._\-/~@+]*$/;
const MAX_FILE_CONTENT_SIZE = 5_242_880;

function booleanField(form: FormData, name: string, fallback = false): boolean {
	if (!form.has(name)) return fallback;
	const value = String(form.getAll(name).at(-1) ?? '').toLowerCase();
	return ['true', '1', 'on', 'yes'].includes(value);
}

function recordsAt(value: unknown, key: string): ResourceRecord[] {
	const record = asRecord(value);
	if (record && key in record) return normalizeRecords(record[key]);
	return [];
}

function nestedBackupState(storage: ResourceRecord): ApplicationStorageSummary['backupState'] {
	const candidate =
		storage.scheduled_backups ??
		storage.scheduledBackups ??
		storage.backup_schedule ??
		storage.backup;
	const records = normalizeRecords(candidate);
	const schedule = records[0] ?? asRecord(candidate);
	if (!schedule) return 'unknown';
	return schedule.enabled === false ? 'disabled' : 'enabled';
}

function truthy(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

function storageSummary(
	storage: ResourceRecord,
	type: ApplicationStorageType,
	applicationReadOnly: boolean
): ApplicationStorageSummary | undefined {
	const id = firstText(storage, ['uuid', 'id']);
	if (!id) return undefined;
	const isDirectory = type === 'file' && truthy(storage.is_directory);
	const isHostFile = type === 'file' && truthy(storage.is_host_file);
	const kind: ApplicationStorageKind =
		type === 'persistent'
			? 'persistent'
			: isDirectory
				? 'directory'
				: isHostFile
					? 'host-file'
					: 'file';
	const name = firstText(storage, ['name']);
	const mountPath = firstText(storage, ['mount_path']);
	const hostPath = firstText(storage, ['host_path']);
	const fsPath = firstText(storage, ['fs_path']);
	const labels: Record<ApplicationStorageKind, string> = {
		persistent: 'Persistent volume',
		file: 'Managed file',
		directory: 'Directory mount',
		'host-file': 'Host file mount'
	};
	return {
		id,
		type,
		kind,
		label: labels[kind],
		name: name || fsPath || mountPath || id,
		mountPath,
		source: type === 'persistent' ? hostPath || name : fsPath || 'Managed by Coolify',
		hostPath,
		fsPath,
		previewSuffixEnabled: storage.is_preview_suffix_enabled !== false,
		readOnly:
			applicationReadOnly ||
			truthy(storage.is_read_only) ||
			truthy(storage.is_readonly) ||
			truthy(storage.read_only),
		backupEligible: type === 'persistent' || (isDirectory && !isHostFile),
		backupState: nestedBackupState(storage)
	};
}

export function normalizeApplicationStorages(
	value: unknown,
	applicationReadOnly = false
): ApplicationStorageSummary[] {
	const record = asRecord(value);
	const persistent = record ? recordsAt(record, 'persistent_storages') : normalizeRecords(value);
	const files = record ? recordsAt(record, 'file_storages') : [];
	return [
		...persistent.map((storage) => storageSummary(storage, 'persistent', applicationReadOnly)),
		...files.map((storage) => storageSummary(storage, 'file', applicationReadOnly))
	].filter((storage): storage is ApplicationStorageSummary => Boolean(storage));
}

export function normalizeS3StorageOptions(value: unknown): S3StorageOption[] {
	return normalizeRecords(value)
		.filter((storage) => truthy(storage.is_usable))
		.map((storage) => ({
			uuid: firstText(storage, ['uuid', 'id']),
			name: firstText(storage, ['name']) || firstText(storage, ['uuid', 'id'])
		}))
		.filter((storage) => Boolean(storage.uuid));
}

function validatePath(value: string, field: string, fieldErrors: Record<string, string>): void {
	if (!value) {
		fieldErrors[field] = 'Path is required.';
		return;
	}
	if (!DIRECTORY_PATH_PATTERN.test(value)) {
		fieldErrors[field] =
			'Use an absolute path containing only letters, numbers, /, ., _, -, ~, @, or +.';
	}
}

function baseStorageValues(form: FormData) {
	return {
		kind: String(form.get('kind') ?? '').trim(),
		name: String(form.get('name') ?? '').trim(),
		mountPath: String(form.get('mount_path') ?? '').trim(),
		hostPath: String(form.get('host_path') ?? '').trim(),
		fsPath: String(form.get('fs_path') ?? '').trim(),
		previewSuffixEnabled: booleanField(form, 'is_preview_suffix_enabled', true),
		replaceContent: booleanField(form, 'replace_content')
	};
}

export function applicationStorageCreateSubmission(
	form: FormData
): StorageSubmission<ApplicationStorageCreateBody> {
	const values = baseStorageValues(form);
	const fieldErrors: Record<string, string> = {};
	const sensitiveValues: string[] = [];
	const content = String(form.get('content') ?? '');
	if (!['persistent', 'file', 'directory', 'host-file'].includes(values.kind)) {
		fieldErrors.kind = 'Choose a supported storage type.';
	}
	validatePath(values.mountPath, 'mount_path', fieldErrors);

	let body: ApplicationStorageCreateBody | undefined;
	if (values.kind === 'persistent') {
		if (!values.name) fieldErrors.name = 'Volume name is required.';
		else if (!VOLUME_NAME_PATTERN.test(values.name)) {
			fieldErrors.name = 'Start with a letter or number and use only letters, numbers, ., _, or -.';
		}
		if (values.hostPath && !DIRECTORY_PATH_PATTERN.test(values.hostPath)) {
			fieldErrors.host_path = 'Host path must be an absolute directory path.';
		}
		if (Object.keys(fieldErrors).length === 0) {
			body = {
				type: 'persistent',
				name: values.name,
				mount_path: values.mountPath,
				...(values.hostPath ? { host_path: values.hostPath } : {})
			};
		}
	} else if (values.kind === 'file') {
		if (content.length > MAX_FILE_CONTENT_SIZE) {
			fieldErrors.content = 'Managed file content must be 5 MiB or smaller.';
		}
		if (content) sensitiveValues.push(content);
		if (Object.keys(fieldErrors).length === 0) {
			body = { type: 'file', mount_path: values.mountPath, content };
		}
	} else if (values.kind === 'directory' || values.kind === 'host-file') {
		validatePath(values.fsPath, 'fs_path', fieldErrors);
		if (Object.keys(fieldErrors).length === 0) {
			body = {
				type: 'file',
				mount_path: values.mountPath,
				...(values.kind === 'directory'
					? { is_directory: true as const }
					: { is_host_file: true as const }),
				fs_path: values.fsPath
			};
		}
	}
	return { body, values, fieldErrors, sensitiveValues };
}

export function applicationStorageUpdateSubmission(
	form: FormData
): StorageSubmission<ApplicationStorageUpdateBody> {
	const values = baseStorageValues(form);
	const id = String(form.get('storage_uuid') ?? '').trim();
	const type = String(form.get('storage_type') ?? '') as ApplicationStorageType;
	const readOnly = booleanField(form, 'read_only');
	const content = String(form.get('content') ?? '');
	const fieldErrors: Record<string, string> = {};
	const sensitiveValues: string[] = [];
	if (!id) fieldErrors.storage_uuid = 'Storage identifier is required.';
	if (!['persistent', 'file'].includes(type)) fieldErrors.storage_type = 'Storage type is invalid.';

	const body: ApplicationStorageUpdateBody = {
		uuid: id,
		type,
		is_preview_suffix_enabled: values.previewSuffixEnabled
	};
	if (!readOnly && type === 'persistent') {
		if (!values.name) fieldErrors.name = 'Volume name is required.';
		else if (!VOLUME_NAME_PATTERN.test(values.name)) {
			fieldErrors.name = 'Start with a letter or number and use only letters, numbers, ., _, or -.';
		}
		validatePath(values.mountPath, 'mount_path', fieldErrors);
		if (values.hostPath && !DIRECTORY_PATH_PATTERN.test(values.hostPath)) {
			fieldErrors.host_path = 'Host path must be an absolute directory path.';
		}
		body.name = values.name;
		body.mount_path = values.mountPath;
		body.host_path = values.hostPath || null;
	}
	if (!readOnly && type === 'file') {
		validatePath(values.mountPath, 'mount_path', fieldErrors);
		body.mount_path = values.mountPath;
		if (values.kind === 'file' && values.replaceContent) {
			if (content.length > MAX_FILE_CONTENT_SIZE) {
				fieldErrors.content = 'Managed file content must be 5 MiB or smaller.';
			}
			body.content = content;
			if (content) sensitiveValues.push(content);
		}
	}
	return {
		body: Object.keys(fieldErrors).length === 0 ? body : undefined,
		values,
		fieldErrors,
		sensitiveValues
	};
}

function numericField(
	form: FormData,
	name: string,
	fallback: number,
	minimum: number,
	maximum: number,
	integer: boolean,
	fieldErrors: Record<string, string>
): number {
	const raw = String(form.get(name) ?? '').trim();
	const value = raw ? Number(raw) : fallback;
	if (
		!Number.isFinite(value) ||
		(integer && !Number.isInteger(value)) ||
		value < minimum ||
		value > maximum
	) {
		fieldErrors[name] = integer
			? `Enter a whole number from ${minimum} to ${maximum}.`
			: `Enter a number from ${minimum} to ${maximum}.`;
	}
	return value;
}

export function applicationBackupScheduleSubmission(
	form: FormData
): StorageSubmission<ApplicationBackupScheduleBody> {
	const fieldErrors: Record<string, string> = {};
	const frequency = String(form.get('frequency') ?? '').trim();
	const enabled = booleanField(form, 'enabled', true);
	const saveS3 = booleanField(form, 'save_s3');
	const disableLocalBackup = booleanField(form, 'disable_local_backup');
	const stopDuringBackup = booleanField(form, 'stop_during_backup');
	const s3StorageUuid = String(form.get('s3_storage_uuid') ?? '').trim();
	if (!frequency) fieldErrors.frequency = 'Backup frequency is required.';
	else if (frequency.length > 255)
		fieldErrors.frequency = 'Frequency must be 255 characters or fewer.';
	if (disableLocalBackup && !saveS3) {
		fieldErrors.disable_local_backup =
			'Local backups can only be disabled when S3 backups are enabled.';
	}
	if (saveS3 && !s3StorageUuid) fieldErrors.s3_storage_uuid = 'Choose a usable S3 storage.';

	const retentionAmountLocally = numericField(
		form,
		'retention_amount_locally',
		7,
		0,
		10_000,
		true,
		fieldErrors
	);
	const retentionDaysLocally = numericField(
		form,
		'retention_days_locally',
		0,
		0,
		2_147_483_647,
		true,
		fieldErrors
	);
	const retentionMaxStorageLocally = numericField(
		form,
		'retention_max_storage_locally',
		0,
		0,
		9_999_999_999,
		false,
		fieldErrors
	);
	const retentionAmountS3 = numericField(
		form,
		'retention_amount_s3',
		7,
		0,
		10_000,
		true,
		fieldErrors
	);
	const retentionDaysS3 = numericField(
		form,
		'retention_days_s3',
		0,
		0,
		2_147_483_647,
		true,
		fieldErrors
	);
	const retentionMaxStorageS3 = numericField(
		form,
		'retention_max_storage_s3',
		0,
		0,
		9_999_999_999,
		false,
		fieldErrors
	);
	const timeout = numericField(form, 'timeout', 36_000, 60, 36_000, true, fieldErrors);
	const values = {
		frequency,
		enabled,
		saveS3,
		disableLocalBackup,
		stopDuringBackup,
		s3StorageUuid,
		retentionAmountLocally,
		retentionDaysLocally,
		retentionMaxStorageLocally,
		retentionAmountS3,
		retentionDaysS3,
		retentionMaxStorageS3,
		timeout
	};
	return {
		body:
			Object.keys(fieldErrors).length === 0
				? {
						frequency,
						enabled,
						save_s3: saveS3,
						disable_local_backup: disableLocalBackup,
						stop_during_backup: stopDuringBackup,
						s3_storage_uuid: saveS3 ? s3StorageUuid : null,
						retention_amount_locally: retentionAmountLocally,
						retention_days_locally: retentionDaysLocally,
						retention_max_storage_locally: retentionMaxStorageLocally,
						retention_amount_s3: retentionAmountS3,
						retention_days_s3: retentionDaysS3,
						retention_max_storage_s3: retentionMaxStorageS3,
						timeout
					}
				: undefined,
		values,
		fieldErrors,
		sensitiveValues: []
	};
}

function stripSensitiveValues(message: string, sensitiveValues: readonly string[]): string {
	return sensitiveValues
		.filter(Boolean)
		.reduce((result, sensitive) => result.replaceAll(sensitive, '[REDACTED]'), message);
}

function firstError(value: unknown): string | undefined {
	const candidate = Array.isArray(value) ? value[0] : value;
	return candidate === undefined ? undefined : String(candidate);
}

export function applicationStorageFailure(
	caught: unknown,
	sensitiveValues: readonly string[]
): ApplicationStorageFailure {
	const status = caught instanceof CoolifyError ? caught.status : 500;
	const details =
		caught instanceof CoolifyError && caught.details && typeof caught.details === 'object'
			? (caught.details as Record<string, unknown>)
			: undefined;
	const errors =
		details?.errors && typeof details.errors === 'object'
			? (details.errors as Record<string, unknown>)
			: {};
	const fieldErrors: Record<string, string> = {};
	for (const [name, rawError] of Object.entries(errors)) {
		if (!STORAGE_FIELDS.has(name)) continue;
		fieldErrors[name] =
			name === 'content'
				? 'Invalid content.'
				: stripSensitiveValues(firstError(rawError) ?? 'Invalid value.', sensitiveValues);
	}
	let error = caught instanceof Error ? caught.message : 'Coolify request failed.';
	if (status === 401) error = 'Coolify rejected the configured API token.';
	if (status === 403) error = 'The Coolify token does not have permission to manage storage.';
	if (status === 409) error = 'A backup or recovery operation is still running.';
	if (status === 429) {
		error =
			caught instanceof CoolifyError && caught.retryAfterSeconds
				? `Coolify rate-limited this request. Retry in ${caught.retryAfterSeconds} seconds.`
				: 'Coolify rate-limited this request. Retry later.';
	}
	return {
		error: stripSensitiveValues(error, sensitiveValues),
		fieldErrors,
		retryAfterSeconds: caught instanceof CoolifyError ? caught.retryAfterSeconds : undefined
	};
}

function failureStatus(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

async function mutateStorage(
	request: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown },
	operation: string,
	username?: string
): Promise<{ success: true; data: unknown } | { success: false; caught: unknown }> {
	const { audit, getCoolifyClient } = await import('./runtime');
	const started = Date.now();
	try {
		const data = await getCoolifyClient().request(request.method, request.path, {
			body: request.body
		});
		audit({
			user: username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { success: true, data };
	} catch (caught) {
		audit({
			user: username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return { success: false, caught };
	}
}

async function invalidateStorageViews(resourceKind: StorageResourceKind): Promise<void> {
	const { invalidateCollection } = await import('./inventory-cache');
	for (const collection of [resourceKind, 'resources', 'projects'])
		invalidateCollection(collection);
}

async function currentStorages(
	resourceKind: StorageResourceKind,
	resourceUuid: string
): Promise<ApplicationStorageSummary[]> {
	const { getCoolifyClient } = await import('./runtime');
	return normalizeApplicationStorages(
		await getCoolifyClient().request(
			'GET',
			`/${resourceKind}/${encodeURIComponent(resourceUuid)}/storages`
		)
	);
}

function eventResourceUuid(event: RequestEvent): string {
	const uuid = event.params.uuid;
	if (!uuid) throw new CoolifyError('Resource identifier is required.', 400);
	return uuid;
}

function storagePath(
	resourceKind: StorageResourceKind,
	resourceUuid: string,
	storageUuid?: string
): string {
	const base = `/${resourceKind}/${encodeURIComponent(resourceUuid)}/storages`;
	return storageUuid ? `${base}/${encodeURIComponent(storageUuid)}` : base;
}

async function targetStorage(
	resourceKind: StorageResourceKind,
	resourceUuid: string,
	storageUuid: string
): Promise<ApplicationStorageSummary | undefined> {
	return (await currentStorages(resourceKind, resourceUuid)).find(
		(storage) => storage.id === storageUuid
	);
}

function safeBackupSchedule(value: unknown): Record<string, unknown> | undefined {
	const record = asRecord(value);
	if (!record) return undefined;
	const allowed = [
		'uuid',
		'storage_uuid',
		'storage_type',
		'frequency',
		'enabled',
		'save_s3',
		'disable_local_backup',
		'stop_during_backup',
		's3_storage_uuid',
		'retention_amount_locally',
		'retention_days_locally',
		'retention_max_storage_locally',
		'retention_amount_s3',
		'retention_days_s3',
		'retention_max_storage_s3',
		'timeout'
	];
	return Object.fromEntries(
		allowed.filter((key) => key in record).map((key) => [key, record[key]])
	);
}

export function createStorageActions(resourceKind: StorageResourceKind) {
	const resourceName = resourceKind.slice(0, -1);
	return {
		createStorage: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const submission = applicationStorageCreateSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted storage fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target: 'create',
					operation: 'create'
				});
			}
			const subresourceUuid = String(form.get('resource_uuid') ?? '').trim();
			if (resourceKind === 'services' && !subresourceUuid)
				return fail(400, {
					error: 'Choose a service container.',
					target: 'create',
					fieldErrors: { resource_uuid: 'A container is required.' }
				});
			const result = await mutateStorage(
				{
					method: 'POST',
					path: storagePath(resourceKind, resourceUuid),
					body: {
						...submission.body,
						...(resourceKind === 'services' ? { resource_uuid: subresourceUuid } : {})
					}
				},
				`create-${resourceName}-storage`,
				event.locals.user?.username
			);
			if (!result.success) {
				return fail(failureStatus(result.caught), {
					...applicationStorageFailure(result.caught, submission.sensitiveValues),
					values: submission.values,
					target: 'create',
					operation: 'create'
				});
			}
			await invalidateStorageViews(resourceKind);
			return { message: 'Storage created', target: 'create', operation: 'create' };
		},

		updateStorage: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('storage_uuid') ?? '');
			const submission = applicationStorageUpdateSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted storage fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target,
					operation: 'update'
				});
			}
			const result = await mutateStorage(
				{ method: 'PATCH', path: storagePath(resourceKind, resourceUuid), body: submission.body },
				`update-${resourceName}-storage`,
				event.locals.user?.username
			);
			if (!result.success) {
				return fail(failureStatus(result.caught), {
					...applicationStorageFailure(result.caught, submission.sensitiveValues),
					values: submission.values,
					target,
					operation: 'update'
				});
			}
			await invalidateStorageViews(resourceKind);
			return { message: 'Storage updated', target, operation: 'update' };
		},

		deleteStorage: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('storage_uuid') ?? '');
			const confirmation = String(form.get('confirmation') ?? '');
			try {
				const storage = await targetStorage(resourceKind, resourceUuid, target);
				if (!storage)
					return fail(404, { error: 'Storage not found.', target, operation: 'delete' });
				if (confirmation !== storage.name && confirmation !== storage.id) {
					return fail(400, {
						error: `Type ${storage.name} exactly to delete this storage.`,
						target,
						operation: 'delete'
					});
				}
				const result = await mutateStorage(
					{ method: 'DELETE', path: storagePath(resourceKind, resourceUuid, target) },
					`delete-${resourceName}-storage`,
					event.locals.user?.username
				);
				if (!result.success) {
					return fail(failureStatus(result.caught), {
						...applicationStorageFailure(result.caught, []),
						target,
						operation: 'delete'
					});
				}
				await invalidateStorageViews(resourceKind);
				return { message: 'Storage deleted', target, operation: 'delete' };
			} catch (caught) {
				return fail(failureStatus(caught), {
					...applicationStorageFailure(caught, []),
					target,
					operation: 'delete'
				});
			}
		},

		upsertBackup: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('storage_uuid') ?? '');
			const submission = applicationBackupScheduleSubmission(form);
			if (!submission.body) {
				return fail(400, {
					error: 'Correct the highlighted backup fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target,
					operation: 'backup-schedule'
				});
			}
			try {
				const storage = await targetStorage(resourceKind, resourceUuid, target);
				if (!storage?.backupEligible) {
					return fail(422, {
						error: 'Only persistent volumes and directory mounts can be backed up.',
						target,
						operation: 'backup-schedule'
					});
				}
				const result = await mutateStorage(
					{
						method: 'PUT',
						path: `${storagePath(resourceKind, resourceUuid, target)}/backups`,
						body: submission.body
					},
					`upsert-${resourceName}-storage-backup`,
					event.locals.user?.username
				);
				if (!result.success) {
					return fail(failureStatus(result.caught), {
						...applicationStorageFailure(result.caught, []),
						values: submission.values,
						target,
						operation: 'backup-schedule'
					});
				}
				await invalidateStorageViews(resourceKind);
				return {
					message: 'Backup schedule saved',
					target,
					operation: 'backup-schedule',
					backupSchedule: safeBackupSchedule(result.data)
				};
			} catch (caught) {
				return fail(failureStatus(caught), {
					...applicationStorageFailure(caught, []),
					values: submission.values,
					target,
					operation: 'backup-schedule'
				});
			}
		},

		runBackup: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('storage_uuid') ?? '');
			if (String(form.get('confirmation') ?? '') !== 'run backup') {
				return fail(400, {
					error: 'Type run backup exactly to queue an immediate backup.',
					target,
					operation: 'backup-run'
				});
			}
			try {
				const storage = await targetStorage(resourceKind, resourceUuid, target);
				if (!storage?.backupEligible) {
					return fail(422, {
						error: 'Only persistent volumes and directory mounts can be backed up.',
						target,
						operation: 'backup-run'
					});
				}
				const result = await mutateStorage(
					{
						method: 'POST',
						path: `${storagePath(resourceKind, resourceUuid, target)}/backups/run`
					},
					`run-${resourceName}-storage-backup`,
					event.locals.user?.username
				);
				if (!result.success) {
					return fail(failureStatus(result.caught), {
						...applicationStorageFailure(result.caught, []),
						target,
						operation: 'backup-run'
					});
				}
				return { message: 'Storage backup queued', target, operation: 'backup-run' };
			} catch (caught) {
				return fail(failureStatus(caught), {
					...applicationStorageFailure(caught, []),
					target,
					operation: 'backup-run'
				});
			}
		},

		deleteBackup: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('storage_uuid') ?? '');
			const confirmation = String(form.get('confirmation') ?? '');
			try {
				const storage = await targetStorage(resourceKind, resourceUuid, target);
				if (!storage)
					return fail(404, { error: 'Storage not found.', target, operation: 'backup-delete' });
				if (confirmation !== storage.name && confirmation !== storage.id) {
					return fail(400, {
						error: `Type ${storage.name} exactly to delete its backup schedule and archives.`,
						target,
						operation: 'backup-delete'
					});
				}
				const result = await mutateStorage(
					{
						method: 'DELETE',
						path: `${storagePath(resourceKind, resourceUuid, target)}/backups`
					},
					`delete-${resourceName}-storage-backup`,
					event.locals.user?.username
				);
				if (!result.success) {
					return fail(failureStatus(result.caught), {
						...applicationStorageFailure(result.caught, []),
						target,
						operation: 'backup-delete'
					});
				}
				await invalidateStorageViews(resourceKind);
				return {
					message: 'Backup schedule and archives deleted',
					target,
					operation: 'backup-delete'
				};
			} catch (caught) {
				return fail(failureStatus(caught), {
					...applicationStorageFailure(caught, []),
					target,
					operation: 'backup-delete'
				});
			}
		}
	};
}

export function createApplicationStorageActions() {
	return createStorageActions('applications');
}
