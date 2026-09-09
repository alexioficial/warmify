import { error, fail } from '@sveltejs/kit';

import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from '$lib/server/coolify-client';
import { createDatabase, databaseCreationFields } from '$lib/server/database-creation';
import {
	createDockerResource,
	dockerCreationFields,
	dockerCreationKinds
} from '$lib/server/docker-creation';
import { collectionForPage } from '$lib/server/inventory-cache';
import { createGitResource, loadCreationGitDiscovery } from '$lib/server/git-creation';
import { createTemplateResource, templateCreationFields } from '$lib/server/template-creation';
import { normalizeRecords } from '$lib/resource-presenter';
import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

const APPLICATION_KINDS = new Set([
	'public-repository',
	'private-deploy-key',
	'github-app',
	'gitlab-app',
	'dockerfile',
	'docker-compose',
	'docker-image',
	'service-template'
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

function checkedKind(kind: string): string {
	if (!APPLICATION_KINDS.has(kind) && !DATABASE_ENGINES.has(kind))
		error(404, 'Resource type not found');
	return kind;
}

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const kind = checkedKind(params.kind);
	const projectUuid = encodeURIComponent(params.uuid);
	const environmentUuid = encodeURIComponent(params.environment);
	const [projectResult, environmentResult, servers, destinations, keys, discovery] =
		await Promise.all([
			getCoolifyClient().request('GET', `/projects/${projectUuid}`),
			getCoolifyClient().request('GET', `/projects/${projectUuid}/${environmentUuid}`),
			collectionForPage('servers').catch(() => []),
			collectionForPage('destinations').catch(() => []),
			kind === 'private-deploy-key' ? optionalGet('/security/keys', []) : [],
			kind === 'github-app' ? loadCreationGitDiscovery(url) : null
		]).catch((caught: unknown) => {
			if (caught instanceof CoolifyError && caught.status === 404)
				error(404, 'Environment not found in this project');
			throw caught;
		});
	const project = asRecord(redactSecrets(projectResult));
	const environment = asRecord(redactSecrets(environmentResult));
	if (
		!project ||
		project.uuid !== params.uuid ||
		!environment ||
		environment.uuid !== params.environment
	)
		error(404, 'Environment not found in this project');
	const projectName = firstText(project, ['name']) || params.uuid;
	const environmentName = firstText(environment, ['name']) || params.environment;
	const projectPath = `/projects/${encodeURIComponent(params.uuid)}`;
	const environmentPath = `${projectPath}/environments/${encodeURIComponent(firstText(environment, ['uuid']) || params.environment)}`;
	return {
		kind,
		templateCreationFields: kind === 'service-template' ? templateCreationFields : [],
		dockerCreationFields: dockerCreationFields(kind),
		databaseCreationFields: DATABASE_ENGINES.has(kind) ? databaseCreationFields(kind) : [],
		projectUuid: params.uuid,
		environmentUuid: firstText(environment, ['uuid']) || params.environment,
		environmentName,
		projectName,
		servers,
		destinations,
		privateKeys: normalizeRecords(keys)
			.map((key) => ({ uuid: firstText(key, ['uuid']), name: firstText(key, ['name']) }))
			.filter((key) => key.uuid),
		discovery,
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
	default: async (event) => {
		const kind = checkedKind(event.params.kind);
		if (DATABASE_ENGINES.has(kind)) return createDatabase(event);
		if (dockerCreationKinds.has(kind)) return createDockerResource(event);
		if (kind === 'service-template') return createTemplateResource(event);
		if (kind === 'gitlab-app')
			return fail(400, {
				error: 'Coolify does not publish an API endpoint for creating a GitLab App resource.'
			});
		return createGitResource(event);
	}
};
