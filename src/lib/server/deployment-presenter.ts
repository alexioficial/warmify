import { asRecord, firstText, normalizeRecords, type ResourceRecord } from '../resource-presenter';

const fields = [
	'deployment_uuid',
	'application_id',
	'application_uuid',
	'application_name',
	'status',
	'commit',
	'commit_message',
	'created_at',
	'updated_at',
	'finished_at',
	'server_name',
	'environment_name',
	'server_id',
	'is_api',
	'is_webhook',
	'rollback',
	'pull_request_id',
	'force_rebuild',
	'restart_only'
];

/** Metadata only: never put logs or configuration snapshots in an inventory cache. */
export function deploymentCollection(value: unknown): ResourceRecord[] {
	const record = asRecord(value);
	const numeric =
		record &&
		Object.keys(record).length > 0 &&
		Object.keys(record).every((key) => /^\d+$/.test(key));
	const rows = normalizeRecords(numeric ? Object.values(record) : value);
	return rows
		.filter(
			(row) =>
				typeof row.deployment_uuid === 'string' &&
				/^[A-Za-z0-9_-]{1,255}$/.test(row.deployment_uuid)
		)
		.map((row) => {
			const metadata = Object.fromEntries(
				fields
					.filter((field) => ['string', 'number', 'boolean'].includes(typeof row[field]))
					.map((field) => [field, row[field]])
			);
			for (const relation of ['server', 'environment']) {
				const name = firstText(asRecord(row[relation]), ['name']);
				if (!metadata[`${relation}_name`] && name) metadata[`${relation}_name`] = name;
			}
			return metadata;
		});
}
