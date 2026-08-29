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
	if (group === 'applications') {
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
