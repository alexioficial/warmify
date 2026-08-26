import { error, fail, redirect } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
import { CoolifyError } from '$lib/server/coolify-client';
import { redactSecrets } from '$lib/server/redact';
import { newResourceRequest } from '$lib/server/resource-actions';
import { audit, getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

async function safeGet(path: string, fallback: unknown) {
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

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const uuid = encodeURIComponent(params.uuid);
	const [project, environments, servers, destinations] = await Promise.all([
		safeGet(`/projects/${uuid}`, null),
		safeGet(`/projects/${uuid}/environments`, []),
		safeGet('/servers', []),
		safeGet('/destinations', [])
	]);
	if (!project) error(404, 'Project not found');
	return {
		projectUuid: params.uuid,
		projectName: firstText(asRecord(project), ['name']) || params.uuid,
		environments,
		servers,
		destinations
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[
				'kind',
				'environment_uuid',
				'server_uuid',
				'destination_uuid',
				'name',
				'description',
				'git_repository',
				'git_branch',
				'build_pack',
				'docker_registry_image_name',
				'docker_registry_image_tag',
				'ports_exposes',
				'domains',
				'engine',
				'image',
				'public_port',
				'service_type'
			].map((name) => [name, String(form.get(name) ?? '').trim()])
		);
		if (!values.environment_uuid || !values.server_uuid) {
			return fail(400, { error: 'Environment and server are required', values });
		}

		const environments = normalizeRecords(
			await safeGet(`/projects/${encodeURIComponent(params.uuid)}/environments`, [])
		);
		const environment = environments.find(
			(row) => firstText(row, ['uuid', 'id']) === values.environment_uuid
		);
		if (!environment) return fail(400, { error: 'Selected environment is unavailable', values });

		const dockerCompose = String(form.get('docker_compose') ?? '');
		if (values.kind === 'service' && !values.service_type && !dockerCompose.trim()) {
			return fail(400, { error: 'Choose a service type or provide Docker Compose', values });
		}

		let redirectTarget: string;
		try {
			const creation = newResourceRequest({
				kind: values.kind as 'public-repository' | 'docker-image' | 'service' | 'database',
				projectUuid: params.uuid,
				serverUuid: values.server_uuid,
				environmentUuid: values.environment_uuid,
				environmentName: firstText(environment, ['name']),
				destinationUuid: values.destination_uuid,
				name: values.name,
				description: values.description,
				instantDeploy: form.has('instant_deploy'),
				fields: {
					git_repository: values.git_repository,
					git_branch: values.git_branch || 'main',
					build_pack: values.build_pack || 'nixpacks',
					docker_registry_image_name: values.docker_registry_image_name,
					docker_registry_image_tag: values.docker_registry_image_tag,
					ports_exposes: values.ports_exposes,
					domains: values.domains,
					engine: values.engine,
					image: values.image,
					public_port: values.public_port,
					is_public: form.has('is_public') ? 'true' : '',
					type: values.service_type,
					docker_compose_raw: dockerCompose.trim()
						? Buffer.from(dockerCompose, 'utf8').toString('base64')
						: ''
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
			if (!uuid) return { message: 'Resource created', values: {} };
			redirectTarget = `/manage/${creation.group}/${encodeURIComponent(uuid)}`;
		} catch (caught) {
			audit({
				user: locals.user?.username,
				operation: 'create-resource',
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
