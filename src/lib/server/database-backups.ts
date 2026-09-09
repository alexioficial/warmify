import { fail, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import {
	backupExecutions,
	backupSubmission,
	backupSummary,
	nativeBackupSupported,
	retentionFields,
	type BackupValues
} from './database-backup-presenter';
import { databaseEngine, databaseCredentials } from './database-presenter';
import { databaseFailure } from './database-pages';
import { normalizeS3StorageOptions } from './application-storage-actions';
import { CoolifyError, type CoolifyRequestOptions } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
const path = (uuid: string, backup?: string) =>
	`/databases/${encodeURIComponent(uuid)}/backups${backup ? `/${encodeURIComponent(backup)}` : ''}`;
async function current(uuid: string) {
	const database = await getCoolifyClient().request(
		'GET',
		`/databases/${encodeURIComponent(uuid)}`
	);
	if (!nativeBackupSupported(databaseEngine(database)))
		throw new CoolifyError(
			'Native database dumps are unavailable for this engine. Use persistent-storage volume backups.',
			405
		);
	return database;
}
async function owned(uuid: string, backup: string) {
	if (!backup) throw new CoolifyError('Backup identifier is required.', 400);
	await current(uuid);
	const rows = normalizeRecords(await getCoolifyClient().request('GET', path(uuid)));
	const row = rows.find((row) => row.uuid === backup);
	if (!row) throw new CoolifyError('Backup schedule not found in this database.', 404);
	return row;
}
export async function loadDatabaseBackups(uuid: string, backup?: string) {
	try {
		const database = await current(uuid);
		const [raw, s3Result] = await Promise.all([
			getCoolifyClient().request('GET', path(uuid)),
			getCoolifyClient()
				.request('GET', '/s3-storages')
				.then((data) => ({ data, error: '' }))
				.catch(() => ({
					data: [],
					error:
						'S3 destinations could not be loaded. Existing S3 configuration will require selecting a validated destination before saving.'
				}))
		]);
		const schedules = normalizeRecords(raw).map((row) => backupSummary(row, s3Result.data));
		const selected = backup ? schedules.find((row) => row.uuid === backup) : undefined;
		if (backup && !selected) throw new CoolifyError('Backup schedule not found.', 404);
		let executions: ReturnType<typeof backupExecutions> = [];
		let executionError = '';
		if (backup) {
			try {
				executions = backupExecutions(
					await getCoolifyClient().request('GET', `${path(uuid, backup)}/executions`)
				);
				// Backup command errors may echo this database's connection credentials.
				const secrets = databaseCredentials(database)
					.map((item) => item.value)
					.filter((value) => value.length > 0)
					.sort((a, b) => b.length - a.length);
				executions = executions.map((entry) => ({
					...entry,
					message: secrets.reduce(
						(text, secret) => text.replaceAll(secret, '[REDACTED]'),
						entry.message
					)
				}));
			} catch (caught) {
				executionError = databaseFailure(caught).error;
			}
		}
		return {
			schedules,
			selected,
			executions,
			executionError,
			retentionFields,
			s3Storages: normalizeS3StorageOptions(s3Result.data),
			s3RequestError: s3Result.error
		};
	} catch (caught) {
		return {
			schedules: [],
			selected: undefined,
			executions: [],
			executionError: '',
			retentionFields,
			s3Storages: [],
			s3RequestError: '',
			requestError: databaseFailure(caught).error
		};
	}
}
async function mutate(
	event: RequestEvent,
	method: 'POST' | 'PATCH' | 'DELETE',
	suffix: string,
	options: CoolifyRequestOptions = {}
) {
	const started = Date.now();
	try {
		const result = await getCoolifyClient().request(
			method,
			`${path(event.params.uuid!, event.params.backup)}${suffix}`,
			options
		);
		audit({
			user: event.locals.user?.username,
			operation: `${method.toLowerCase()}-database-backup`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return result;
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation: `${method.toLowerCase()}-database-backup`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		throw caught;
	}
}
function failure(caught: unknown, values?: BackupValues) {
	const result = databaseFailure(caught);
	const details = caught instanceof CoolifyError ? asRecord(caught.details) : undefined;
	const errors = asRecord(details?.errors);
	const fieldErrors: Record<string, string> = {};
	// Field messages are generic to avoid reflecting engine output or secrets from an error.
	for (const key of Object.keys(values ?? {}))
		if (errors?.[key]) fieldErrors[key] = 'Invalid value. Check this setting.';
	return fail(result.status, { error: result.error, values, fieldErrors });
}
export function createDatabaseBackupActions() {
	async function save(event: RequestEvent, create: boolean) {
		const submission = backupSubmission(await event.request.formData(), create);
		if (Object.keys(submission.fieldErrors).length)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values: submission.values,
				fieldErrors: submission.fieldErrors
			});
		try {
			if (create) await current(event.params.uuid!);
			else await owned(event.params.uuid!, event.params.backup!);
			if (submission.body.save_s3 === true) {
				const options = normalizeS3StorageOptions(
					await getCoolifyClient().request('GET', '/s3-storages')
				);
				if (!options.some((option) => option.uuid === submission.body.s3_storage_uuid))
					return fail(400, {
						error: 'Select a validated S3 destination.',
						values: submission.values,
						fieldErrors: { s3_storage_uuid: 'Destination is unavailable or not validated.' }
					});
			}
			const result = await mutate(event, create ? 'POST' : 'PATCH', '', { body: submission.body });
			const id = firstText(asRecord(result), ['uuid']);
			if (create && id)
				redirect(
					303,
					`/databases/${encodeURIComponent(event.params.uuid!)}/backups/${encodeURIComponent(id)}`
				);
			return {
				message: create ? 'Backup schedule created' : 'Backup schedule saved',
				values: submission.values
			};
		} catch (caught) {
			if (isRedirect(caught)) throw caught;
			return failure(caught, submission.values);
		}
	}
	return {
		create: (event: RequestEvent) => save(event, true),
		update: (event: RequestEvent) => save(event, false),
		run: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				await owned(event.params.uuid!, event.params.backup!);
				if (form.get('confirmation') !== `run ${event.params.backup}`)
					return fail(400, { error: `Type run ${event.params.backup} exactly to queue a backup.` });
				await mutate(event, 'PATCH', '', { body: { backup_now: true } });
				return { message: 'Database backup queued' };
			} catch (caught) {
				return failure(caught);
			}
		},
		deleteSchedule: async (event: RequestEvent) => {
			const form = await event.request.formData();
			try {
				await owned(event.params.uuid!, event.params.backup!);
				if (form.get('confirmation') !== event.params.backup)
					return fail(400, {
						error: 'Type the schedule UUID exactly to delete the schedule and its local archives.'
					});
				await mutate(event, 'DELETE', '', {
					query: { delete_s3: form.getAll('delete_s3').at(-1) === 'true' }
				});
				redirect(303, `/databases/${encodeURIComponent(event.params.uuid!)}/backups`);
			} catch (caught) {
				if (isRedirect(caught)) throw caught;
				return failure(caught);
			}
		},
		deleteExecution: async (event: RequestEvent) => {
			const form = await event.request.formData();
			const id = String(form.get('execution_uuid') ?? '');
			try {
				await owned(event.params.uuid!, event.params.backup!);
				const executions = backupExecutions(
					await getCoolifyClient().request(
						'GET',
						`${path(event.params.uuid!, event.params.backup)}/executions`
					)
				);
				if (!id || !executions.some((entry) => entry.uuid === id))
					return fail(404, { error: 'Backup execution not found in this schedule.' });
				if (form.get('confirmation') !== id)
					return fail(400, {
						error: 'Type the execution UUID exactly to delete its local archive.'
					});
				await mutate(event, 'DELETE', `/executions/${encodeURIComponent(id)}`, {
					query: { delete_s3: form.getAll('delete_s3').at(-1) === 'true' }
				});
				return { message: 'Backup execution deleted' };
			} catch (caught) {
				return failure(caught);
			}
		}
	};
}
