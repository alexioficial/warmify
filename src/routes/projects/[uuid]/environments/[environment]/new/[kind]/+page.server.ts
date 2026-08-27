import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { detailPath } from '$lib/resource-routes';
import { CoolifyError } from '$lib/server/coolify-client';
import { collectionForPage, invalidateCollection } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';
import { newResourceRequest, type NewResourceInput } from '$lib/server/resource-actions';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

const APPLICATION_KINDS = new Set([
	'public-repository',
	'private-deploy-key',
	'github-app',
	'gitlab-app',
	'dockerfile',
	'docker-compose',
	'docker-image'
]);
const DATABASE_ENGINES = new Set([
	'postgresql',
	'mysql',
	'mariadb',
	'redis',
	'keydb',
	'dragonfly',
	'mongodb',
	'clickhouse'
]);

async function optionalGet(path: string, fallback: unknown) {
	try {
		return redactSecrets(await getCoolifyClient().request('GET', path));
	} catch {
		return fallback;
	}
}

function statusFor(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

function checkedKind(kind: string): string {
	if (!APPLICATION_KINDS.has(kind) && !DATABASE_ENGINES.has(kind)) error(404, 'Resource type not found');
	return kind;
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const kind = checkedKind(params.kind);
	const projectUuid = encodeURIComponent(params.uuid);
	const environmentUuid = encodeURIComponent(params.environment);
	const [projectResult, environmentResult, servers, destinations, privateKeys, githubApps] =
		await Promise.all([
			getCoolifyClient().request('GET', `/projects/${projectUuid}`),
			getCoolifyClient().request('GET', `/projects/${projectUuid}/${environmentUuid}`),
			collectionForPage('servers').catch(() => []),
			collectionForPage('destinations').catch(() => []),
			optionalGet('/security/keys', []),
			optionalGet('/github-apps', [])
		]);
	const project = asRecord(redactSecrets(projectResult));
	const environment = asRecord(redactSecrets(environmentResult));
	if (!project || !environment) error(404, 'Environment not found');
	const projectName = firstText(project, ['name']) || params.uuid;
	const environmentName = firstText(environment, ['name']) || params.environment;
	const projectPath = `/projects/${encodeURIComponent(params.uuid)}`;
	const environmentPath = `${projectPath}/environments/${encodeURIComponent(firstText(environment, ['uuid']) || params.environment)}`;
	return {
		kind,
		projectUuid: params.uuid,
		environmentUuid: firstText(environment, ['uuid']) || params.environment,
		environmentName,
		projectName,
		servers,
		destinations,
		privateKeys,
		githubApps,
		breadcrumbs: [
			{ label: 'Projects', href: '/projects' },
			{ label: projectName, href: projectPath },
			{ label: environmentName, href: environmentPath },
			{ label: 'New resource', href: `${environmentPath}/new` },
			{ label: kind, href: `${environmentPath}/new/${encodeURIComponent(kind)}` }
		]
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const selectedKind = checkedKind(params.kind);
		if (selectedKind === 'gitlab-app') {
			return fail(400, {
				error: 'Coolify does not publish an API endpoint for creating a GitLab App resource.'
			});
		}

		const form = await request.formData();
		const names = [
			'server_uuid',
			'destination_uuid',
			'name',
			'description',
			'domains',
			'git_repository',
			'git_branch',
			'build_pack',
			'ports_exposes',
			'private_key_uuid',
			'github_app_uuid',
			'docker_registry_image_name',
			'docker_registry_image_tag',
			'image',
			'public_port'
		];
		const values = Object.fromEntries(
			names.map((name) => [name, String(form.get(name) ?? '').trim()])
		);
		if (!values.server_uuid) return fail(400, { error: 'Server is required', values });
		if (
			['public-repository', 'private-deploy-key', 'github-app'].includes(selectedKind) &&
			(!values.git_repository || !values.ports_exposes)
		) {
			return fail(400, { error: 'Repository URL and exposed ports are required', values });
		}
		if (selectedKind === 'private-deploy-key' && !values.private_key_uuid) {
			return fail(400, { error: 'Private key is required', values });
		}
		if (selectedKind === 'github-app' && !values.github_app_uuid) {
			return fail(400, { error: 'GitHub App is required', values });
		}
		if (selectedKind === 'docker-image' && !values.docker_registry_image_name) {
			return fail(400, { error: 'Docker image name is required', values });
		}

		const environmentResult = await optionalGet(
			`/projects/${encodeURIComponent(params.uuid)}/${encodeURIComponent(params.environment)}`,
			null
		);
		const environment = asRecord(environmentResult);
		if (!environment) return fail(404, { error: 'Environment not found', values });

		const dockerfile = String(form.get('dockerfile') ?? '').trim();
		const dockerCompose = String(form.get('docker_compose') ?? '').trim();
		if (selectedKind === 'dockerfile' && !dockerfile)
			return fail(400, { error: 'Dockerfile content is required', values });
		if (selectedKind === 'docker-compose' && !dockerCompose)
			return fail(400, { error: 'Docker Compose content is required', values });

		let kind: NewResourceInput['kind'];
		if (DATABASE_ENGINES.has(selectedKind)) kind = 'database';
		else kind = selectedKind as NewResourceInput['kind'];

		let redirectTarget: string;
		try {
			const creation = newResourceRequest({
				kind,
				projectUuid: params.uuid,
				serverUuid: values.server_uuid,
				environmentUuid: firstText(environment, ['uuid']) || params.environment,
				environmentName: firstText(environment, ['name']) || params.environment,
				destinationUuid: values.destination_uuid,
				name: values.name,
				description: values.description,
				instantDeploy: form.has('instant_deploy'),
				fields: {
					git_repository: values.git_repository,
					git_branch: values.git_branch || 'main',
					build_pack: values.build_pack || 'nixpacks',
					ports_exposes: values.ports_exposes,
					domains: values.domains,
					private_key_uuid: values.private_key_uuid,
					github_app_uuid: values.github_app_uuid,
					dockerfile,
					docker_compose_raw: dockerCompose
						? Buffer.from(dockerCompose, 'utf8').toString('base64')
						: '',
					docker_registry_image_name: values.docker_registry_image_name,
					docker_registry_image_tag: values.docker_registry_image_tag || 'latest',
					engine: DATABASE_ENGINES.has(selectedKind) ? selectedKind : '',
					image: values.image,
					public_port: values.public_port,
					is_public: form.has('is_public') ? 'true' : ''
				}
			});
			const started = Date.now();
			const result = await getCoolifyClient().request(
				creation.request.method,
				creation.request.path,
				creation.request.options
			);
			audit({
				user: locals.user?.username,
				operation: `create-${creation.group}`,
				result: 'success',
				duration_ms: Date.now() - started
			});
			const uuid = firstText(asRecord(result), ['uuid', 'id']);
			invalidateCollection(creation.group);
			invalidateCollection('resources');
			invalidateCollection('projects');
			if (!uuid) {
				redirectTarget = `/projects/${encodeURIComponent(params.uuid)}/environments/${encodeURIComponent(params.environment)}`;
			} else {
				redirectTarget = detailPath(creation.group, uuid) ?? '/projects';
			}
		} catch (caught) {
			audit({
				user: locals.user?.username,
				operation: `create-${selectedKind}`,
				result: 'error'
			});
			return fail(statusFor(caught), {
				error: caught instanceof Error ? caught.message : 'Coolify request failed',
				values
			});
		}
		redirect(303, redirectTarget);
	}
};
