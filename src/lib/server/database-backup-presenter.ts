import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
export const nativeBackupSupported = (engine: string) =>
	['postgresql', 'mysql', 'mariadb', 'mongodb', 'clickhouse'].includes(engine);
export const retentionFields = ['locally', 's3'].flatMap((location) =>
	['amount', 'days', 'max_storage'].map((limit) => ({
		name: `database_backup_retention_${limit}_${location}`,
		label: `${location === 's3' ? 'S3' : 'Local'} ${limit === 'amount' ? 'backups to keep' : limit === 'days' ? 'days to keep' : 'maximum storage (GB)'}`,
		decimal: limit === 'max_storage'
	}))
);
const stringFields = ['frequency', 'databases_to_backup', 's3_storage_uuid'];
const booleanFields = ['enabled', 'save_s3', 'dump_all'];
const numericFields = ['timeout', ...retentionFields.map((field) => field.name)];
export type BackupValues = Record<string, string | boolean>;
export interface BackupActionResult {
	error?: string;
	message?: string;
	values?: BackupValues;
	fieldErrors?: Record<string, string>;
}
const bool = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
export function backupSubmission(form: FormData, create: boolean) {
	const body: Record<string, unknown> = {};
	const values: BackupValues = {};
	const fieldErrors: Record<string, string> = {};
	for (const key of [...stringFields, ...booleanFields, ...numericFields]) {
		if (!form.has(key)) continue;
		const value = String(form.getAll(key).at(-1) ?? '').trim();
		values[key] = booleanFields.includes(key) ? bool(value) : value;
		if (booleanFields.includes(key)) body[key] = values[key];
		else if (numericFields.includes(key)) {
			if (!value) continue;
			const n = Number(value);
			const decimal = key.includes('max_storage');
			if (
				!Number.isFinite(n) ||
				n < 0 ||
				(!decimal && !Number.isSafeInteger(n)) ||
				(key === 'timeout' && (n < 60 || n > 36000))
			)
				fieldErrors[key] =
					key === 'timeout'
						? 'Enter a whole number between 60 and 36000.'
						: 'Enter a non-negative number' + (decimal ? '.' : ' without decimals.');
			else body[key] = n;
		} else body[key] = value || (key === 'frequency' ? '' : null);
	}
	if ((create || form.has('frequency')) && !body.frequency)
		fieldErrors.frequency = 'Frequency is required.';
	if (body.save_s3 === true && !body.s3_storage_uuid)
		fieldErrors.s3_storage_uuid = 'Select an S3 destination.';
	return { body, values, fieldErrors };
}
export function backupSummary(value: unknown, s3: unknown = []) {
	const record = asRecord(value);
	const values: BackupValues = {};
	for (const key of [...stringFields, ...numericFields]) values[key] = firstText(record, [key]);
	for (const key of booleanFields) values[key] = bool(record?.[key]);
	if (!values.s3_storage_uuid && record?.s3_storage_id != null) {
		const destination = normalizeRecords(s3).find(
			(row) => String(row.id) === String(record.s3_storage_id)
		);
		values.s3_storage_uuid = firstText(destination, ['uuid']);
	}
	return {
		uuid: firstText(record, ['uuid']),
		frequency: firstText(record, ['frequency']),
		enabled: bool(record?.enabled),
		saveS3: bool(record?.save_s3),
		values
	};
}
export function backupExecutions(value: unknown) {
	const record = asRecord(value);
	return normalizeRecords(record?.executions ?? value)
		.map((row) => ({
			uuid: firstText(row, ['uuid']),
			status: firstText(row, ['status']) || 'unknown',
			filename: firstText(row, ['filename']),
			size: firstText(row, ['size']),
			createdAt: firstText(row, ['created_at']),
			message: firstText(row, ['message'])
		}))
		.filter((row) => row.uuid);
}
