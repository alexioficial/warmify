const COLLECTION_PATHS = {
	projects: '/projects',
	applications: '/applications',
	services: '/services',
	databases: '/databases',
	deployments: '/deployments',
	servers: '/servers',
	sources: '/sources',
	destinations: '/destinations',
	storage: '/storage',
	security: '/security/keys',
	teams: '/teams',
	resources: '/resources',
	system: '/system'
} as const;

export type CollectionPath = (typeof COLLECTION_PATHS)[keyof typeof COLLECTION_PATHS];
export type DetailPath =
	| `/projects/${string}`
	| `/applications/${string}`
	| `/services/${string}`
	| `/databases/${string}`
	| `/deployments/${string}`
	| `/servers/${string}`
	| `/destinations/${string}`
	| `/storage/${string}`
	| `/security/keys/${string}`
	| `/teams/${string}`;

export interface ApplicationNavigationItem {
	slug: string;
	label: string;
}

export interface ApplicationNavigationGroup {
	label: string;
	items: ApplicationNavigationItem[];
}

const DETAIL_GROUPS = new Set([
	'projects',
	'applications',
	'services',
	'databases',
	'deployments',
	'servers',
	'destinations',
	'storage',
	'security',
	'teams'
]);

export function collectionPath(group: string): CollectionPath | undefined {
	return COLLECTION_PATHS[group as keyof typeof COLLECTION_PATHS];
}

export function detailPath(group: string, identifier: string): DetailPath | undefined {
	const collection = collectionPath(group);
	if (!collection || !DETAIL_GROUPS.has(group)) return undefined;
	if (group === 'databases') return `/databases/${encodeURIComponent(identifier)}/general`;
	if (group === 'applications') {
		return `${collection}/${encodeURIComponent(identifier)}/general` as DetailPath;
	}
	if (group === 'services') {
		return `${collection}/${encodeURIComponent(identifier)}/general` as DetailPath;
	}
	if (group === 'destinations') {
		return `${collection}/${encodeURIComponent(identifier)}/general` as DetailPath;
	}
	if (group === 'storage') {
		return `${collection}/${encodeURIComponent(identifier)}/general` as DetailPath;
	}
	return `${collection}/${encodeURIComponent(identifier)}` as DetailPath;
}

export function applicationNavigation(application: unknown): ApplicationNavigationGroup[] {
	const record =
		application !== null && typeof application === 'object' && !Array.isArray(application)
			? (application as Record<string, unknown>)
			: {};
	const buildPack = typeof record.build_pack === 'string' ? record.build_pack : '';
	const isCompose = buildPack === 'dockercompose';
	const isGitBased =
		typeof record.git_repository === 'string' && record.git_repository.trim() !== '';
	const supportsPreviews = isGitBased || buildPack === 'dockerimage';
	const item = (slug: string, label: string): ApplicationNavigationItem => ({ slug, label });

	return [
		{
			label: 'Settings',
			items: [
				item('general', 'General'),
				item('application-details', 'Application details'),
				item('access', 'Access'),
				item('build-pipeline', 'Build pipeline'),
				...(!isCompose
					? [
							item('container-image', 'Container image'),
							item('networking', 'Networking'),
							item('runtime', 'Runtime'),
							item('security', 'Security')
						]
					: []),
				item('deployment-lifecycle', 'Deployment lifecycle'),
				...(!isCompose ? [item('container-labels', 'Container labels')] : []),
				item('domains', 'Domains'),
				item('environment-variables', 'Environment variables'),
				item('persistent-storage', 'Persistent storage'),
				item('advanced', 'Advanced'),
				...(!isCompose ? [item('healthcheck', 'Healthcheck')] : [])
			]
		},
		{
			label: 'Observe & troubleshoot',
			items: [item('runtime-logs', 'Runtime logs'), item('deployments', 'Deployment logs')]
		},
		{
			label: 'Deploy',
			items: [
				...(isGitBased ? [item('git-source', 'Git source')] : []),
				item('destinations', 'Servers'),
				...(supportsPreviews ? [item('preview-deployments', 'Preview deployments')] : [])
			]
		},
		{
			label: 'Automation',
			items: [
				item('scheduled-tasks', 'Scheduled tasks'),
				item('webhooks', 'Webhooks'),
				item('backups', 'Backups')
			]
		},
		{
			label: 'Operations',
			items: [
				item('resource-operations', 'Resource operations'),
				item('resource-limits', 'Resource limits'),
				item('rollback', 'Rollback'),
				item('tags', 'Tags'),
				item('danger', 'Danger zone')
			]
		}
	];
}

export function serviceNavigation(): ApplicationNavigationGroup[] {
	const item = (slug: string, label: string): ApplicationNavigationItem => ({ slug, label });
	return [
		{
			label: 'Settings',
			items: [
				item('general', 'General'),
				item('resources', 'Service resources'),
				item('compose', 'Docker Compose'),
				item('domains', 'Domains'),
				item('environment-variables', 'Environment variables'),
				item('persistent-storage', 'Persistent storage')
			]
		},
		{
			label: 'Observe & troubleshoot',
			items: [item('runtime-logs', 'Runtime logs')]
		},
		{
			label: 'Automation',
			items: [item('scheduled-tasks', 'Scheduled tasks'), item('backups', 'Backups')]
		},
		{
			label: 'Operations',
			items: [
				item('resource-operations', 'Resource operations'),
				item('tags', 'Tags'),
				item('danger', 'Danger zone')
			]
		}
	];
}

export function serverNavigation(): ApplicationNavigationGroup[] {
	return [
		{
			label: 'Settings',
			items: [
				{ slug: 'general', label: 'General' },
				{ slug: 'environment-variables', label: 'Environment variables' },
				{ slug: 'advanced', label: 'Advanced' }
			]
		},
		{
			label: 'Platform',
			items: [{ slug: 'resources', label: 'Resources' }]
		},
		{
			label: 'Networking',
			items: [
				{ slug: 'destinations', label: 'Destinations' },
				{ slug: 'domains', label: 'Domains' },
				{ slug: 'proxy', label: 'Proxy' },
				{ slug: 'cloudflare-tunnel', label: 'Cloudflare Tunnel' }
			]
		},
		{
			label: 'Observe & troubleshoot',
			items: [
				{ slug: 'sentinel', label: 'Sentinel' },
				{ slug: 'log-drains', label: 'Log drains' }
			]
		},
		{
			label: 'Operations',
			items: [
				{ slug: 'validation', label: 'Validation' },
				{ slug: 'docker-cleanup', label: 'Docker cleanup' },
				{ slug: 'capabilities', label: 'API availability' },
				{ slug: 'danger', label: 'Danger zone' }
			]
		}
	];
}

export function databaseNavigation(engine: string): ApplicationNavigationGroup[] {
	return [
		{
			label: 'Settings',
			items: [
				{ slug: 'general', label: 'General' },
				{ slug: 'credentials', label: 'Credentials' },
				...(engine === 'postgresql' ? [{ slug: 'initialization', label: 'Initialization' }] : []),
				...(['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'keydb'].includes(engine)
					? [{ slug: 'configuration', label: 'Configuration' }]
					: []),
				{ slug: 'networking', label: 'Networking' },
				{ slug: 'healthcheck', label: 'Healthcheck' },
				{ slug: 'environment-variables', label: 'Environment variables' },
				{ slug: 'persistent-storage', label: 'Persistent storage' },
				...(['postgresql', 'mysql', 'mariadb', 'mongodb', 'clickhouse'].includes(engine)
					? [{ slug: 'backups', label: 'Backups' }]
					: [])
			]
		},
		{ label: 'Observe & troubleshoot', items: [{ slug: 'runtime-logs', label: 'Runtime logs' }] },
		{ label: 'Deploy', items: [{ slug: 'servers', label: 'Servers' }] },
		{
			label: 'Operations',
			items: [
				{ slug: 'resource-limits', label: 'Resource limits' },
				{ slug: 'resource-operations', label: 'Resource operations' },
				{ slug: 'tags', label: 'Tags' },
				{ slug: 'danger', label: 'Danger zone' }
			]
		}
	];
}
