import { asRecord, firstText, normalizeRecords } from '../resource-presenter';

export interface ApplicationDestinationSummary {
	uuid: string;
	name: string;
	network: string;
	serverUuid: string;
	isPrimary: boolean;
}

export interface RollbackImageSummary {
	tag: string;
	createdAt: string;
	isCurrent: boolean;
}

export interface ApplicationTagSummary {
	uuid: string;
	name: string;
}

export interface ApplicationOperationOption {
	uuid: string;
	name: string;
	description: string;
}

export interface ApplicationEnvironmentOption extends ApplicationOperationOption {
	projectUuid: string;
	projectName: string;
}

export interface GithubAppOption {
	id: string;
	uuid: string;
	name: string;
}

export interface GithubRepositoryOption {
	fullName: string;
	name: string;
}

export interface GithubBranchOption {
	name: string;
}

export function normalizeApplicationDestinations(value: unknown): ApplicationDestinationSummary[] {
	return normalizeRecords(value)
		.map((destination) => {
			const uuid = firstText(destination, ['uuid', 'id']);
			if (!uuid) return undefined;
			return {
				uuid,
				name: firstText(destination, ['name']) || uuid,
				network: firstText(destination, ['network']),
				serverUuid: firstText(destination, ['server_uuid']),
				isPrimary: destination.is_primary === true
			};
		})
		.filter((destination) => destination !== undefined);
}

export function normalizeRollbackImages(value: unknown): {
	current: string;
	images: RollbackImageSummary[];
} {
	const record = asRecord(value);
	return {
		current: firstText(record, ['current']),
		images: normalizeRecords(record?.images)
			.map((image) => {
				const tag = firstText(image, ['tag']);
				return tag
					? {
							tag,
							createdAt: firstText(image, ['created_at']),
							isCurrent: image.is_current === true
						}
					: undefined;
			})
			.filter((image) => image !== undefined)
	};
}

export function normalizeApplicationTags(value: unknown): ApplicationTagSummary[] {
	return normalizeRecords(value)
		.map((tag) => {
			const uuid = firstText(tag, ['uuid', 'id']);
			const name = firstText(tag, ['name', 'tag_name']);
			return uuid && name ? { uuid, name } : undefined;
		})
		.filter((tag) => tag !== undefined);
}

export function normalizeOperationDestinations(value: unknown): ApplicationOperationOption[] {
	return normalizeRecords(value)
		.map((destination) => {
			const uuid = firstText(destination, ['uuid', 'id']);
			if (!uuid) return undefined;
			const server = asRecord(destination.server);
			return {
				uuid,
				name: firstText(destination, ['name']) || uuid,
				description: firstText(server, ['name']) || firstText(destination, ['network'])
			};
		})
		.filter((destination) => destination !== undefined);
}

export function normalizeOperationEnvironments(value: unknown): ApplicationEnvironmentOption[] {
	const options: ApplicationEnvironmentOption[] = [];
	for (const project of normalizeRecords(value)) {
		const projectUuid = firstText(project, ['uuid', 'id']);
		const projectName = firstText(project, ['name']) || projectUuid;
		for (const environment of normalizeRecords(project.environments)) {
			const uuid = firstText(environment, ['uuid', 'id']);
			if (!projectUuid || !uuid) continue;
			options.push({
				uuid,
				name: firstText(environment, ['name']) || uuid,
				description: projectName,
				projectUuid,
				projectName
			});
		}
	}
	return options;
}

export function normalizeGithubApps(value: unknown): GithubAppOption[] {
	return normalizeRecords(value)
		.map((app) => {
			const id = firstText(app, ['id']);
			const uuid = firstText(app, ['uuid']);
			return id && uuid ? { id, uuid, name: firstText(app, ['name']) || uuid } : undefined;
		})
		.filter((app) => app !== undefined);
}

export function normalizeGithubRepositories(value: unknown): GithubRepositoryOption[] {
	const record = asRecord(value);
	return normalizeRecords(record?.repositories)
		.map((repository) => {
			const owner = asRecord(repository.owner);
			const name = firstText(repository, ['name']);
			const fullName =
				firstText(repository, ['full_name']) ||
				(firstText(owner, ['login']) && name ? `${firstText(owner, ['login'])}/${name}` : '');
			return fullName ? { fullName, name: name || fullName } : undefined;
		})
		.filter((repository) => repository !== undefined);
}

export function normalizeGithubBranches(value: unknown): GithubBranchOption[] {
	const record = asRecord(value);
	return normalizeRecords(record?.branches)
		.map((branch) => {
			const name = firstText(branch, ['name']);
			return name ? { name } : undefined;
		})
		.filter((branch) => branch !== undefined);
}
