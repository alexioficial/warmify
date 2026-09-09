import { describe, expect, test } from 'vitest';

import { CoolifyError } from './coolify-client';
import {
	applicationBackupScheduleSubmission,
	applicationStorageCreateSubmission,
	applicationStorageFailure,
	applicationStorageUpdateSubmission,
	normalizeApplicationStorages,
	normalizeS3StorageOptions
} from './application-storage-actions';

describe('application storage actions', () => {
	test('normalizes persistent and file storage collections without exposing managed file content', () => {
		const result = normalizeApplicationStorages(
			{
				persistent_storages: [
					{
						uuid: 'volume-1',
						name: 'app-1-data',
						mount_path: '/data',
						host_path: null,
						is_preview_suffix_enabled: true
					}
				],
				file_storages: [
					{
						uuid: 'file-1',
						mount_path: '/app/config.json',
						fs_path: '/data/coolify/applications/app-1/config.json',
						content: 'do-not-leak',
						is_directory: false,
						is_host_file: false
					},
					{
						uuid: 'directory-1',
						mount_path: '/uploads',
						fs_path: '/srv/uploads',
						is_directory: true,
						is_host_file: false
					}
				]
			},
			false
		);

		expect(result).toHaveLength(3);
		expect(result[0]).toMatchObject({
			id: 'volume-1',
			type: 'persistent',
			kind: 'persistent',
			backupEligible: true,
			previewSuffixEnabled: true
		});
		expect(result[1]).toMatchObject({
			id: 'file-1',
			type: 'file',
			kind: 'file',
			backupEligible: false
		});
		expect(result[2]).toMatchObject({
			kind: 'directory',
			backupEligible: true,
			source: '/srv/uploads'
		});
		expect(JSON.stringify(result)).not.toContain('do-not-leak');
	});

	test('marks Docker Compose application storage read-only and recognizes host files', () => {
		const [storage] = normalizeApplicationStorages(
			{
				file_storages: [
					{
						uuid: 'host-file-1',
						mount_path: '/etc/example.conf',
						fs_path: '/srv/example.conf',
						is_host_file: true
					}
				]
			},
			true
		);
		expect(storage).toMatchObject({
			kind: 'host-file',
			readOnly: true,
			backupEligible: false
		});
	});

	test('builds exact create bodies for all documented storage kinds and never echoes content', () => {
		const persistent = new FormData();
		persistent.set('kind', 'persistent');
		persistent.set('name', 'uploads');
		persistent.set('mount_path', '/uploads');
		persistent.set('host_path', '/srv/uploads');
		expect(applicationStorageCreateSubmission(persistent).body).toEqual({
			type: 'persistent',
			name: 'uploads',
			mount_path: '/uploads',
			host_path: '/srv/uploads'
		});

		const managedFile = new FormData();
		managedFile.set('kind', 'file');
		managedFile.set('mount_path', '/app/config.json');
		managedFile.set('content', '{"token":"secret"}');
		const managedSubmission = applicationStorageCreateSubmission(managedFile);
		expect(managedSubmission.body).toEqual({
			type: 'file',
			mount_path: '/app/config.json',
			content: '{"token":"secret"}'
		});
		expect(managedSubmission.values).not.toHaveProperty('content');
		expect(managedSubmission.sensitiveValues).toEqual(['{"token":"secret"}']);

		const directory = new FormData();
		directory.set('kind', 'directory');
		directory.set('mount_path', '/uploads');
		directory.set('fs_path', '/srv/uploads');
		expect(applicationStorageCreateSubmission(directory).body).toEqual({
			type: 'file',
			mount_path: '/uploads',
			is_directory: true,
			fs_path: '/srv/uploads'
		});

		const hostFile = new FormData();
		hostFile.set('kind', 'host-file');
		hostFile.set('mount_path', '/etc/example.conf');
		hostFile.set('fs_path', '/srv/example.conf');
		expect(applicationStorageCreateSubmission(hostFile).body).toEqual({
			type: 'file',
			mount_path: '/etc/example.conf',
			is_host_file: true,
			fs_path: '/srv/example.conf'
		});
	});

	test('limits update fields by storage type and only sends replacement file content explicitly', () => {
		const persistent = new FormData();
		persistent.set('storage_uuid', 'volume-1');
		persistent.set('storage_type', 'persistent');
		persistent.set('kind', 'persistent');
		persistent.set('name', 'data');
		persistent.set('mount_path', '/data');
		persistent.set('host_path', '');
		persistent.set('is_preview_suffix_enabled', 'false');
		expect(applicationStorageUpdateSubmission(persistent).body).toEqual({
			uuid: 'volume-1',
			type: 'persistent',
			name: 'data',
			mount_path: '/data',
			host_path: null,
			is_preview_suffix_enabled: false
		});

		const file = new FormData();
		file.set('storage_uuid', 'file-1');
		file.set('storage_type', 'file');
		file.set('kind', 'file');
		file.set('mount_path', '/app/config.json');
		file.set('replace_content', 'false');
		file.set('content', 'ignored-secret');
		const withoutReplacement = applicationStorageUpdateSubmission(file);
		expect(withoutReplacement.body).not.toHaveProperty('content');
		expect(withoutReplacement.sensitiveValues).toEqual([]);

		file.set('replace_content', 'true');
		const withReplacement = applicationStorageUpdateSubmission(file);
		expect(withReplacement.body).toMatchObject({ content: 'ignored-secret' });
		expect(withReplacement.values).not.toHaveProperty('content');
		expect(withReplacement.sensitiveValues).toEqual(['ignored-secret']);
	});

	test('builds the documented backup schedule shape and validates S3-only local disabling', () => {
		const form = new FormData();
		form.set('frequency', '0 2 * * *');
		form.set('enabled', 'true');
		form.set('save_s3', 'true');
		form.set('disable_local_backup', 'true');
		form.set('stop_during_backup', 'false');
		form.set('s3_storage_uuid', 's3-1');
		form.set('retention_amount_locally', '7');
		form.set('retention_days_locally', '14');
		form.set('retention_max_storage_locally', '10.5');
		form.set('retention_amount_s3', '12');
		form.set('retention_days_s3', '30');
		form.set('retention_max_storage_s3', '25');
		form.set('timeout', '3600');
		const submission = applicationBackupScheduleSubmission(form);
		expect(submission.fieldErrors).toEqual({});
		expect(submission.body).toEqual({
			frequency: '0 2 * * *',
			enabled: true,
			save_s3: true,
			disable_local_backup: true,
			stop_during_backup: false,
			s3_storage_uuid: 's3-1',
			retention_amount_locally: 7,
			retention_days_locally: 14,
			retention_max_storage_locally: 10.5,
			retention_amount_s3: 12,
			retention_days_s3: 30,
			retention_max_storage_s3: 25,
			timeout: 3600
		});

		form.set('save_s3', 'false');
		expect(applicationBackupScheduleSubmission(form).fieldErrors).toMatchObject({
			disable_local_backup: 'Local backups can only be disabled when S3 backups are enabled.'
		});
	});

	test('keeps only usable S3 metadata and maps API failures without leaking file content', () => {
		expect(
			normalizeS3StorageOptions([
				{ uuid: 's3-1', name: 'Backups', is_usable: true, secret_access_key: 'secret' },
				{ uuid: 's3-2', name: 'Broken', is_usable: false }
			])
		).toEqual([{ uuid: 's3-1', name: 'Backups' }]);

		const failure = applicationStorageFailure(
			new CoolifyError('Content do-not-leak failed.', 422, {
				errors: { content: ['do-not-leak is invalid'], mount_path: ['Path is invalid.'] }
			}),
			['do-not-leak']
		);
		expect(failure).toEqual({
			error: 'Content [REDACTED] failed.',
			fieldErrors: { content: 'Invalid content.', mount_path: 'Path is invalid.' },
			retryAfterSeconds: undefined
		});
		expect(JSON.stringify(failure)).not.toContain('do-not-leak');
	});
});
