import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';

export interface PrivateKeyView {
	uuid: string;
	name: string;
	description: string;
	publicKey: string;
	fingerprint: string;
	isGitRelated: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TeamView {
	id: string;
	name: string;
	description: string;
	personalTeam: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TeamMemberView {
	id: string;
	name: string;
	email: string;
	emailVerifiedAt: string;
	twoFactorEnabled: boolean;
	forcePasswordReset: boolean;
	createdAt: string;
}

const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const validUuid = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const numericId = (value: unknown) => /^[0-9]+$/.test(String(value ?? ''));

export function privateKeyView(value: unknown): PrivateKeyView | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validUuid(uuid)) return undefined;
	return {
		uuid,
		name: firstText(row, ['name']) || 'Private key',
		description: firstText(row, ['description']),
		publicKey: firstText(row, ['public_key']),
		fingerprint: firstText(row, ['fingerprint']),
		isGitRelated: flag(row?.is_git_related),
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

export function privateKeyCollection(value: unknown): PrivateKeyView[] {
	return normalizeRecords(value)
		.map(privateKeyView)
		.filter((entry): entry is PrivateKeyView => entry !== undefined);
}

export function teamView(value: unknown): TeamView | undefined {
	const row = asRecord(value);
	if (!numericId(row?.id)) return undefined;
	return {
		id: String(row!.id),
		name: firstText(row, ['name']) || 'Team',
		description: firstText(row, ['description']),
		personalTeam: flag(row?.personal_team),
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

export function teamCollection(value: unknown): TeamView[] {
	return normalizeRecords(value)
		.map(teamView)
		.filter((entry): entry is TeamView => entry !== undefined);
}

export function teamMemberCollection(value: unknown): TeamMemberView[] {
	return normalizeRecords(value)
		.filter((row) => numericId(row.id))
		.map((row) => ({
			id: String(row.id),
			name: firstText(row, ['name']) || firstText(row, ['email']) || 'Member',
			email: firstText(row, ['email']),
			emailVerifiedAt: firstText(row, ['email_verified_at']),
			twoFactorEnabled: Boolean(firstText(row, ['two_factor_confirmed_at'])),
			forcePasswordReset: flag(row.force_password_reset),
			createdAt: firstText(row, ['created_at'])
		}));
}
