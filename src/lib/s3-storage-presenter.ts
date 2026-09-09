import { asRecord, firstText } from '$lib/resource-presenter';

export interface S3StorageView {
	uuid: string;
	name: string;
	description: string;
	endpoint: string;
	bucket: string;
	region: string;
	isUsable: boolean;
	teamId?: number;
	createdAt: string;
	updatedAt: string;
}

const validUuid = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);

export function s3StorageView(value: unknown): S3StorageView | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validUuid(uuid)) return undefined;
	const teamId = Number(row?.team_id);
	return {
		uuid,
		name: firstText(row, ['name']) || 'S3 storage',
		description: firstText(row, ['description']),
		endpoint: firstText(row, ['endpoint']),
		bucket: firstText(row, ['bucket']),
		region: firstText(row, ['region']),
		isUsable: row?.is_usable === true || row?.is_usable === 'true' || row?.is_usable === 1,
		...(Number.isSafeInteger(teamId) ? { teamId } : {}),
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

export function s3StorageCollection(value: unknown): S3StorageView[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(s3StorageView)
		.filter((storage): storage is S3StorageView => storage !== undefined);
}
