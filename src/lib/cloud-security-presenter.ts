import { asRecord, firstText } from '$lib/resource-presenter';

export type CloudProvider = 'hetzner' | 'digitalocean' | 'vultr';

export interface CloudTokenView {
	uuid: string;
	name: string;
	provider: CloudProvider;
	serversCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CloudInitScriptView {
	uuid: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

const validUuid = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);

export function cloudProvider(value: unknown): CloudProvider | undefined {
	return value === 'hetzner' || value === 'digitalocean' || value === 'vultr' ? value : undefined;
}

export function cloudProviderLabel(provider: CloudProvider): string {
	return provider === 'digitalocean'
		? 'DigitalOcean'
		: provider === 'hetzner'
			? 'Hetzner'
			: 'Vultr';
}

export function cloudTokenView(value: unknown): CloudTokenView | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	const provider = cloudProvider(row?.provider);
	if (!validUuid(uuid) || !provider) return undefined;
	const serversCount = Number(row?.servers_count);
	return {
		uuid,
		name: firstText(row, ['name']) || `${cloudProviderLabel(provider)} token`,
		provider,
		serversCount: Number.isSafeInteger(serversCount) && serversCount >= 0 ? serversCount : 0,
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

export function cloudTokenCollection(value: unknown): CloudTokenView[] {
	if (!Array.isArray(value)) return [];
	return value.map(cloudTokenView).filter((entry): entry is CloudTokenView => entry !== undefined);
}

export function cloudInitScriptView(value: unknown): CloudInitScriptView | undefined {
	const row = asRecord(value);
	const uuid = firstText(row, ['uuid']);
	if (!validUuid(uuid)) return undefined;
	return {
		uuid,
		name: firstText(row, ['name']) || 'Cloud-init script',
		createdAt: firstText(row, ['created_at']),
		updatedAt: firstText(row, ['updated_at'])
	};
}

export function cloudInitScriptCollection(value: unknown): CloudInitScriptView[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(cloudInitScriptView)
		.filter((entry): entry is CloudInitScriptView => entry !== undefined);
}
