import { fail, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText } from '../resource-presenter';

import {
	normalizeApplicationDestinations,
	normalizeApplicationTags,
	normalizeGithubApps,
	normalizeGithubBranches,
	normalizeGithubRepositories,
	normalizeOperationDestinations,
	normalizeOperationEnvironments,
	normalizeRollbackImages,
	type GithubAppOption,
	type GithubBranchOption,
	type GithubRepositoryOption
} from './application-operation-presenter';
export type {
	ApplicationDestinationSummary,
	ApplicationEnvironmentOption,
	ApplicationOperationOption,
	ApplicationTagSummary,
	GithubAppOption,
	GithubBranchOption,
	GithubRepositoryOption,
	RollbackImageSummary
} from './application-operation-presenter';
export {
	normalizeApplicationDestinations,
	normalizeApplicationTags,
	normalizeGithubApps,
	normalizeGithubBranches,
	normalizeGithubRepositories,
	normalizeOperationDestinations,
	normalizeOperationEnvironments,
	normalizeRollbackImages
} from './application-operation-presenter';
import { CoolifyError } from './coolify-client';
import { collectionForPage, invalidateCollection } from './inventory-cache';
import { redactSecrets } from './redact';
import { audit, getCoolifyClient } from './runtime';

function booleanValue(form: FormData, name: string, fallback: boolean): boolean {
	if (!form.has(name)) return fallback;
	const value = String(form.getAll(name).at(-1) ?? '').toLowerCase();
	return ['true', '1', 'on', 'yes'].includes(value);
}

function requestStatus(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

function requestFailure(
	caught: unknown,
	allowedFields: readonly string[] = []
): { error: string; fieldErrors: Record<string, string> } {
	const details = caught instanceof CoolifyError ? asRecord(caught.details) : undefined;
	const errors = asRecord(details?.errors);
	const allowed = new Set(allowedFields);
	const fieldErrors: Record<string, string> = {};
	for (const [field, raw] of Object.entries(errors ?? {})) {
		if (!allowed.has(field)) continue;
		const first = Array.isArray(raw) ? raw[0] : raw;
		fieldErrors[field] = String(first ?? 'Invalid value.');
	}
	let error = caught instanceof Error ? caught.message : 'Coolify request failed.';
	if (caught instanceof CoolifyError && caught.status === 401)
		error = 'Coolify rejected the configured API token.';
	if (caught instanceof CoolifyError && caught.status === 403)
		error = 'The Coolify token cannot perform this operation.';
	if (caught instanceof CoolifyError && caught.status === 429)
		error = caught.retryAfterSeconds
			? `Coolify rate-limited this request. Retry in ${caught.retryAfterSeconds} seconds.`
			: 'Coolify rate-limited this request. Retry later.';
	return { error, fieldErrors };
}

function applicationUuid(event: RequestEvent): string {
	const uuid = event.params.uuid;
	if (!uuid) throw new CoolifyError('Application identifier is required.', 400);
	return uuid;
}

function applicationPath(uuid: string, suffix = ''): string {
	return `/applications/${encodeURIComponent(uuid)}${suffix}`;
}

async function mutate(
	event: RequestEvent,
	request: {
		method: 'POST' | 'DELETE';
		path: string;
		body?: unknown;
		query?: Record<string, string | number | boolean | undefined>;
	},
	operation: string
) {
	const started = Date.now();
	try {
		const data = await getCoolifyClient().request(request.method, request.path, {
			body: request.body,
			query: request.query
		});
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { success: true as const, data };
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return { success: false as const, caught };
	}
}

function invalidateApplicationViews(): void {
	for (const collection of ['applications', 'resources', 'projects', 'deployments'])
		invalidateCollection(collection);
}

async function currentApplicationName(uuid: string): Promise<string> {
	const application = asRecord(
		redactSecrets(await getCoolifyClient().request('GET', applicationPath(uuid)))
	);
	return firstText(application, ['name']) || uuid;
}

export async function loadGitSourceDiscovery(url: URL) {
	const selectedGithubAppId = url.searchParams.get('github_app_id')?.trim() ?? '';
	const selectedRepository = url.searchParams.get('repository')?.trim() ?? '';
	let githubApps: GithubAppOption[] = [];
	let repositories: GithubRepositoryOption[] = [];
	let branches: GithubBranchOption[] = [];
	let discoveryError: string | undefined;
	try {
		githubApps = normalizeGithubApps(
			redactSecrets(await getCoolifyClient().request('GET', '/github-apps'))
		);
		if (selectedGithubAppId && githubApps.some((app) => app.id === selectedGithubAppId)) {
			repositories = normalizeGithubRepositories(
				redactSecrets(
					await getCoolifyClient().request(
						'GET',
						`/github-apps/${encodeURIComponent(selectedGithubAppId)}/repositories`
					)
				)
			);
			if (
				selectedRepository &&
				repositories.some((repository) => repository.fullName === selectedRepository)
			) {
				const [owner, repository] = selectedRepository.split('/', 2);
				if (owner && repository) {
					branches = normalizeGithubBranches(
						redactSecrets(
							await getCoolifyClient().request(
								'GET',
								`/github-apps/${encodeURIComponent(selectedGithubAppId)}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches`
							)
						)
					);
				}
			}
		}
	} catch (caught) {
		discoveryError = requestFailure(caught).error;
	}
	return {
		githubApps,
		repositories,
		branches,
		selectedGithubAppId,
		selectedRepository,
		...(discoveryError ? { discoveryError } : {})
	};
}

export async function loadApplicationDestinations(uuid: string) {
	try {
		const [attached, allDestinations] = await Promise.all([
			getCoolifyClient().request('GET', applicationPath(uuid, '/destinations')),
			collectionForPage('destinations')
		]);
		const destinations = normalizeApplicationDestinations(redactSecrets(attached));
		const attachedIds = new Set(destinations.map((destination) => destination.uuid));
		return {
			destinations,
			availableDestinations: normalizeOperationDestinations(allDestinations).filter(
				(destination) => !attachedIds.has(destination.uuid)
			)
		};
	} catch (caught) {
		return {
			destinations: [],
			availableDestinations: [],
			requestError: requestFailure(caught).error
		};
	}
}

export async function loadApplicationRollback(uuid: string) {
	try {
		return normalizeRollbackImages(
			redactSecrets(
				await getCoolifyClient().request('GET', applicationPath(uuid, '/rollback-images'))
			)
		);
	} catch (caught) {
		return { current: '', images: [], requestError: requestFailure(caught).error };
	}
}

export async function loadApplicationTags(uuid: string) {
	try {
		return {
			tags: normalizeApplicationTags(
				redactSecrets(await getCoolifyClient().request('GET', applicationPath(uuid, '/tags')))
			)
		};
	} catch (caught) {
		return { tags: [], requestError: requestFailure(caught).error };
	}
}

export async function loadApplicationOperationOptions() {
	const [destinations, projects] = await Promise.allSettled([
		collectionForPage('destinations'),
		collectionForPage('projects')
	]);
	return {
		destinations:
			destinations.status === 'fulfilled' ? normalizeOperationDestinations(destinations.value) : [],
		environments:
			projects.status === 'fulfilled' ? normalizeOperationEnvironments(projects.value) : [],
		...(destinations.status === 'rejected'
			? { destinationError: requestFailure(destinations.reason).error }
			: {}),
		...(projects.status === 'rejected'
			? { environmentError: requestFailure(projects.reason).error }
			: {})
	};
}

export function createApplicationDestinationActions() {
	return {
		addDestination: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const destinationUuid = String(form.get('destination_uuid') ?? '').trim();
			if (!destinationUuid)
				return fail(400, {
					error: 'Choose a destination.',
					fieldErrors: { destination_uuid: 'Destination is required.' },
					operation: 'add'
				});
			const result = await mutate(
				event,
				{
					method: 'POST',
					path: applicationPath(uuid, '/destinations'),
					body: { destination_uuid: destinationUuid }
				},
				'add-application-destination'
			);
			if (!result.success)
				return fail(requestStatus(result.caught), {
					...requestFailure(result.caught, ['destination_uuid']),
					operation: 'add'
				});
			invalidateApplicationViews();
			return { message: 'Destination attached', operation: 'add' };
		},

		removeDestination: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const destinationUuid = String(form.get('destination_uuid') ?? '').trim();
			try {
				const destinations = normalizeApplicationDestinations(
					await getCoolifyClient().request('GET', applicationPath(uuid, '/destinations'))
				);
				const destination = destinations.find((candidate) => candidate.uuid === destinationUuid);
				if (!destination)
					return fail(404, { error: 'Destination not found.', operation: 'remove' });
				if (destination.isPrimary)
					return fail(422, {
						error: 'The primary destination cannot be removed.',
						operation: 'remove'
					});
				const confirmation = String(form.get('confirmation') ?? '');
				if (confirmation !== destination.name && confirmation !== destination.uuid)
					return fail(400, {
						error: `Type ${destination.name} exactly to remove this destination.`,
						operation: 'remove',
						target: destinationUuid
					});
				const result = await mutate(
					event,
					{
						method: 'DELETE',
						path: applicationPath(uuid, `/destinations/${encodeURIComponent(destinationUuid)}`)
					},
					'remove-application-destination'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught),
						operation: 'remove',
						target: destinationUuid
					});
				invalidateApplicationViews();
				return { message: 'Destination detached', operation: 'remove' };
			} catch (caught) {
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'remove' });
			}
		}
	};
}

export function createApplicationRollbackActions() {
	return {
		rollback: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const commit = String(form.get('commit') ?? '').trim();
			try {
				const rollback = normalizeRollbackImages(
					await getCoolifyClient().request('GET', applicationPath(uuid, '/rollback-images'))
				);
				if (!rollback.images.some((image) => image.tag === commit && !image.isCurrent))
					return fail(400, { error: 'Choose an available previous image.', operation: 'rollback' });
				if (String(form.get('confirmation') ?? '') !== `rollback ${commit}`)
					return fail(400, {
						error: `Type rollback ${commit} exactly to queue this deployment.`,
						operation: 'rollback'
					});
				const result = await mutate(
					event,
					{
						method: 'POST',
						path: applicationPath(uuid, '/rollback'),
						body: { commit }
					},
					'rollback-application'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught, ['commit']),
						operation: 'rollback'
					});
				invalidateApplicationViews();
				const response = asRecord(result.data);
				return {
					message: firstText(response, ['message']) || 'Rollback deployment queued',
					deploymentUuid: firstText(response, ['deployment_uuid']),
					operation: 'rollback'
				};
			} catch (caught) {
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'rollback' });
			}
		}
	};
}

export function createApplicationTagActions() {
	return {
		addTags: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const tagNames = String(form.get('tag_names') ?? '')
				.split(/[\n,]/)
				.map((name) => name.trim())
				.filter(Boolean);
			const invalid = tagNames.find((name) => name.length < 2);
			if (!tagNames.length || invalid)
				return fail(400, {
					error: 'Enter one or more tags of at least two characters.',
					fieldErrors: { tag_names: 'Separate multiple tags with commas or new lines.' },
					operation: 'add'
				});
			const result = await mutate(
				event,
				{
					method: 'POST',
					path: applicationPath(uuid, '/tags'),
					body: { tag_names: [...new Set(tagNames)] }
				},
				'add-application-tags'
			);
			if (!result.success)
				return fail(requestStatus(result.caught), {
					...requestFailure(result.caught, ['tag_name', 'tag_names']),
					operation: 'add'
				});
			invalidateApplicationViews();
			return { message: 'Tags added', operation: 'add' };
		},

		deleteTag: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const tagUuid = String(form.get('tag_uuid') ?? '').trim();
			try {
				const tags = normalizeApplicationTags(
					await getCoolifyClient().request('GET', applicationPath(uuid, '/tags'))
				);
				const tag = tags.find((candidate) => candidate.uuid === tagUuid);
				if (!tag) return fail(404, { error: 'Tag not found.', operation: 'delete' });
				if (String(form.get('confirmation') ?? '') !== tag.name)
					return fail(400, {
						error: `Type ${tag.name} exactly to remove this tag.`,
						operation: 'delete',
						target: tagUuid
					});
				const result = await mutate(
					event,
					{
						method: 'DELETE',
						path: applicationPath(uuid, `/tags/${encodeURIComponent(tagUuid)}`)
					},
					'delete-application-tag'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught),
						operation: 'delete',
						target: tagUuid
					});
				invalidateApplicationViews();
				return { message: `Tag ${tag.name} removed`, operation: 'delete' };
			} catch (caught) {
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'delete' });
			}
		}
	};
}

export function createApplicationResourceOperationActions() {
	return {
		cloneApplication: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const destinationUuid = String(form.get('destination_uuid') ?? '').trim();
			const name = String(form.get('name') ?? '').trim();
			try {
				const applicationName = await currentApplicationName(uuid);
				if (String(form.get('confirmation') ?? '') !== `clone ${applicationName}`)
					return fail(400, {
						error: `Type clone ${applicationName} exactly to clone this application.`,
						operation: 'clone'
					});
				if (!destinationUuid)
					return fail(400, { error: 'Choose a destination.', operation: 'clone' });
				const result = await mutate(
					event,
					{
						method: 'POST',
						path: applicationPath(uuid, '/clone'),
						body: {
							destination_uuid: destinationUuid,
							...(name ? { name } : {}),
							clone_volumes: booleanValue(form, 'clone_volumes', false)
						}
					},
					'clone-application'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught, ['destination_uuid', 'name', 'clone_volumes']),
						operation: 'clone'
					});
				invalidateApplicationViews();
				const clonedUuid = firstText(asRecord(result.data), ['uuid']);
				if (clonedUuid) redirect(303, `/applications/${encodeURIComponent(clonedUuid)}/general`);
				return { message: 'Application cloned', operation: 'clone' };
			} catch (caught) {
				if (isRedirect(caught)) throw caught;
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'clone' });
			}
		},

		moveApplication: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const environmentUuid = String(form.get('environment_uuid') ?? '').trim();
			try {
				const applicationName = await currentApplicationName(uuid);
				if (String(form.get('confirmation') ?? '') !== `move ${applicationName}`)
					return fail(400, {
						error: `Type move ${applicationName} exactly to move this application.`,
						operation: 'move'
					});
				if (!environmentUuid)
					return fail(400, { error: 'Choose an environment.', operation: 'move' });
				const result = await mutate(
					event,
					{
						method: 'POST',
						path: applicationPath(uuid, '/move'),
						body: { environment_uuid: environmentUuid }
					},
					'move-application'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught, ['environment_uuid']),
						operation: 'move'
					});
				invalidateApplicationViews();
				redirect(303, applicationPath(uuid, '/general'));
			} catch (caught) {
				if (isRedirect(caught)) throw caught;
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'move' });
			}
		},

		migrateApplication: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			const destinationUuid = String(form.get('destination_uuid') ?? '').trim();
			try {
				const applicationName = await currentApplicationName(uuid);
				if (String(form.get('confirmation') ?? '') !== `migrate ${applicationName}`)
					return fail(400, {
						error: `Type migrate ${applicationName} exactly to migrate this application.`,
						operation: 'migrate'
					});
				if (!destinationUuid)
					return fail(400, { error: 'Choose a destination.', operation: 'migrate' });
				const result = await mutate(
					event,
					{
						method: 'POST',
						path: applicationPath(uuid, '/migrate'),
						body: {
							destination_uuid: destinationUuid,
							migrate_volumes: booleanValue(form, 'migrate_volumes', true)
						}
					},
					'migrate-application'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), {
						...requestFailure(result.caught, ['destination_uuid', 'migrate_volumes']),
						operation: 'migrate'
					});
				invalidateApplicationViews();
				return {
					message:
						firstText(asRecord(result.data), ['message']) || 'Application migration requested',
					operation: 'migrate'
				};
			} catch (caught) {
				return fail(requestStatus(caught), { ...requestFailure(caught), operation: 'migrate' });
			}
		}
	};
}

export function createApplicationDangerActions() {
	return {
		deleteApplication: async (event: RequestEvent) => {
			const uuid = applicationUuid(event);
			const form = await event.request.formData();
			try {
				const name = await currentApplicationName(uuid);
				const confirmation = String(form.get('confirmation') ?? '');
				if (confirmation !== name && confirmation !== uuid)
					return fail(400, {
						error: `Type ${name} or ${uuid} exactly to delete this application.`
					});
				const result = await mutate(
					event,
					{
						method: 'DELETE',
						path: applicationPath(uuid),
						query: {
							delete_configurations: booleanValue(form, 'delete_configurations', true),
							delete_volumes: booleanValue(form, 'delete_volumes', true),
							docker_cleanup: booleanValue(form, 'docker_cleanup', true),
							delete_connected_networks: booleanValue(form, 'delete_connected_networks', true)
						}
					},
					'delete-application'
				);
				if (!result.success)
					return fail(requestStatus(result.caught), requestFailure(result.caught));
				invalidateApplicationViews();
				redirect(303, '/applications');
			} catch (caught) {
				if (isRedirect(caught)) throw caught;
				return fail(requestStatus(caught), requestFailure(caught));
			}
		}
	};
}
