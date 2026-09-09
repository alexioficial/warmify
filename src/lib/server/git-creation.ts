import { error, fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { gitBuildPacks, gitCreationFields, gitKinds } from '../git-creation-fields';
import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import {
	normalizeGithubApps,
	normalizeGithubBranches,
	normalizeGithubRepositories,
	type GithubAppOption,
	type GithubBranchOption,
	type GithubRepositoryOption
} from './application-operation-presenter';
import { CoolifyError } from './coolify-client';
import { invalidateCollection } from './inventory-cache';
import { loadHierarchy } from './project-actions';
import { configurationSubmission } from './resource-actions';
import { audit, getCoolifyClient } from './runtime';

export function gitCreationSubmission(form: FormData, kind: string) {
	const pack = String(form.get('build_pack') ?? '');
	const fields = gitCreationFields(kind, pack);
	const supplied = new FormData();
	for (const field of fields) {
		const value = form.getAll(field.name).at(-1);
		if (value != null && String(value).trim()) supplied.set(field.name, value);
	}
	const result = configurationSubmission(supplied, fields);
	const { body, values, fieldErrors } = result;
	if (!gitBuildPacks.includes(pack)) fieldErrors.build_pack = 'Select a supported build pack.';
	for (const key of [
		'server_uuid',
		'git_repository',
		'git_branch',
		...(kind === 'github-app'
			? ['github_app_uuid']
			: kind === 'private-deploy-key'
				? ['private_key_uuid']
				: [])
	])
		if (!body[key]) fieldErrors[key] = 'This field is required.';
	const branch = String(body.git_branch ?? '');
	if (
		branch &&
		(!/^[A-Za-z0-9_./-]+$/.test(branch) ||
			/\.\.|\/\/|^[/.]|[/.]$|\.lock$/.test(branch) ||
			branch === 'HEAD')
	)
		fieldErrors.git_branch = 'Use a valid branch name.';
	const repository = String(body.git_repository ?? '');
	let validRepository =
		kind === 'github-app' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
	if (!validRepository && /^(https?:\/\/|git:\/\/|git@)/.test(repository)) {
		validRepository =
			!/[\s;|&$`()[\]{}<>"'\\!?*^%=+#]/.test(repository) && !repository.includes('../');
		if (/^https?:\/\//.test(repository)) {
			try {
				const url = new URL(repository);
				validRepository &&=
					!url.username &&
					!url.password &&
					!!url.hostname &&
					!!url.pathname &&
					!url.search &&
					!url.hash;
			} catch {
				validRepository = false;
			}
		} else
			validRepository &&=
				/^(?:git@[A-Za-z0-9.-]+:|git:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?\/)[A-Za-z0-9_./~-]+$/.test(
					repository
				);
	}
	if (!validRepository) {
		fieldErrors.git_repository =
			'Use a repository URL without embedded credentials, or owner/repository for a GitHub App.';
		delete values.git_repository;
		delete body.git_repository;
	}
	if (String(body.name ?? '').length > 255) fieldErrors.name = 'Use at most 255 characters.';
	const ports = String(body.ports_exposes ?? '');
	if (
		ports &&
		(!/^\d+(,\d+)*$/.test(ports) ||
			ports.split(',').some((port) => Number(port) < 1 || Number(port) > 65535))
	)
		fieldErrors.ports_exposes = 'Use comma-separated ports between 1 and 65535.';
	return result;
}
export async function createGitResource(event: RequestEvent) {
	const kind = event.params.kind!;
	let values: Record<string, string | boolean> = {};
	let pack = '';
	const started = Date.now();
	try {
		if (!event.locals.user) error(401, 'Authentication required.');
		if (event.request.headers.get('origin') !== event.url.origin)
			error(403, 'Same-origin request required.');
		if (!gitKinds.includes(kind)) error(404, 'Unsupported Git source.');
		const submission = gitCreationSubmission(await event.request.formData(), kind);
		values = submission.values;
		pack = String(values.build_pack ?? '');
		if (Object.keys(submission.fieldErrors).length)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values,
				fieldErrors: submission.fieldErrors
			});
		const context = await loadHierarchy(event);
		if (context.kind !== 'environment') error(404, 'Environment required.');
		if (kind !== 'public-repository') {
			const key = kind === 'github-app' ? 'github_app_uuid' : 'private_key_uuid';
			const rows = normalizeRecords(
				await getCoolifyClient().request(
					'GET',
					kind === 'github-app' ? '/github-apps' : '/security/keys'
				)
			);
			if (!rows.some((row) => row.uuid === submission.body[key]))
				error(404, 'Selected Git source is no longer available.');
		}
		const endpoint =
			kind === 'github-app'
				? 'private-github-app'
				: kind === 'private-deploy-key'
					? kind
					: 'public';
		const response = await getCoolifyClient().request('POST', `/applications/${endpoint}`, {
			body: { ...submission.body, project_uuid: event.params.uuid, environment_uuid: context.uuid }
		});
		for (const group of ['applications', 'projects', 'resources', 'deployments'])
			invalidateCollection(group);
		audit({
			user: event.locals.user.username,
			operation: `create-${kind}`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		const uuid = firstText(asRecord(response), ['uuid']);
		redirect(303, uuid ? `/applications/${encodeURIComponent(uuid)}/general` : context.href);
	} catch (caught) {
		if (isRedirect(caught)) throw caught;
		const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
		const errors =
			caught instanceof CoolifyError ? asRecord(asRecord(caught.details)?.errors) : undefined;
		const fieldErrors = Object.fromEntries(
			gitCreationFields(kind, pack)
				.filter((field) => errors && field.name in errors)
				.map((field) => [field.name, 'Coolify rejected this value.'])
		);
		// Repository providers and command validators can echo credentials or command fragments.
		const message = isHttpError(caught)
			? caught.body.message
			: status === 422 || status === 400
				? 'Coolify rejected the configuration. Review the fields and re-enter custom commands.'
				: status === 404
					? 'Project, environment, server or repository source was not found or is inaccessible.'
					: status === 409
						? 'This configuration conflicts with an existing resource.'
						: 'Creation could not be completed. Check the environment before retrying.';
		audit({
			user: event.locals.user?.username,
			operation: `create-${kind}`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status, { error: message, values, fieldErrors });
	}
}
export async function loadCreationGitDiscovery(url: URL) {
	const selectedGithubAppId = url.searchParams.get('github_app_id')?.trim() ?? '';
	const selectedRepository = url.searchParams.get('repository')?.trim() ?? '';
	let githubApps: GithubAppOption[] = [];
	let repositories: GithubRepositoryOption[] = [];
	let branches: GithubBranchOption[] = [];
	let discoveryError = '';
	try {
		githubApps = normalizeGithubApps(
			await getCoolifyClient().request('GET', '/github-apps')
		).filter((app) => /^[1-9][0-9]*$/.test(app.id));
		if (selectedGithubAppId) {
			if (!githubApps.some((app) => app.id === selectedGithubAppId))
				throw new Error('Unknown source');
			repositories = normalizeGithubRepositories(
				await getCoolifyClient().request('GET', `/github-apps/${selectedGithubAppId}/repositories`)
			);
			if (selectedRepository) {
				if (
					!repositories.some((repo) => repo.fullName === selectedRepository) ||
					!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(selectedRepository)
				)
					throw new Error('Unknown repository');
				const [owner, repo] = selectedRepository.split('/');
				branches = normalizeGithubBranches(
					await getCoolifyClient().request(
						'GET',
						`/github-apps/${selectedGithubAppId}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
					)
				);
			}
		}
	} catch {
		discoveryError =
			'GitHub discovery could not be completed. Check the selected App, its installation and repository access. You can also enter the repository and branch manually.';
	}
	return {
		githubApps,
		repositories,
		branches,
		selectedGithubAppId,
		selectedRepository,
		discoveryError
	};
}
