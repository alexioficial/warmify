import { asRecord, firstText } from '$lib/resource-presenter';

export type SourceProvider = 'github' | 'gitlab';

export interface SourceView {
	id: number;
	uuid: string;
	provider: SourceProvider;
	name: string;
	organization: string;
	groupName: string;
	apiUrl: string;
	htmlUrl: string;
	customUser: string;
	customPort: number;
	appId?: number;
	installationId?: number;
	clientId: string;
	privateKeyId?: number;
	redirectUri: string;
	isSystemWide: boolean;
	isPublic: boolean;
	teamId?: number;
	owned: boolean;
}

const validUuid = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const integer = (value: unknown) => {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
};
const checked = (value: unknown) => value === true || value === 'true' || value === '1';

export function sourceView(
	value: unknown,
	provider: SourceProvider,
	currentTeamId?: number
): SourceView | undefined {
	const row = asRecord(value);
	const id = integer(row?.id);
	const uuid = firstText(row, ['uuid']);
	if (!id || !validUuid(uuid)) return undefined;
	const teamId = integer(row?.team_id);
	return {
		id,
		uuid,
		provider,
		name: firstText(row, ['name']) || `${provider === 'github' ? 'GitHub' : 'GitLab'} App`,
		organization: provider === 'github' ? firstText(row, ['organization']) : '',
		groupName: provider === 'gitlab' ? firstText(row, ['group_name']) : '',
		apiUrl: firstText(row, ['api_url']),
		htmlUrl: firstText(row, ['html_url']),
		customUser: firstText(row, ['custom_user']) || 'git',
		customPort: integer(row?.custom_port) ?? 22,
		...(provider === 'github'
			? {
					appId: integer(row?.app_id),
					installationId: integer(row?.installation_id),
					privateKeyId: integer(row?.private_key_id)
				}
			: {}),
		clientId: firstText(row, ['client_id']),
		redirectUri: provider === 'gitlab' ? firstText(row, ['redirect_uri']) : '',
		isSystemWide: checked(row?.is_system_wide),
		isPublic: checked(row?.is_public),
		teamId,
		owned: currentTeamId !== undefined && teamId === currentTeamId
	};
}

export function sourceCollection(value: unknown): SourceView[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((row) => {
			const provider = firstText(asRecord(row), ['provider']).toLowerCase();
			return provider === 'github' || provider === 'gitlab' ? sourceView(row, provider) : undefined;
		})
		.filter((source): source is SourceView => source !== undefined);
}
