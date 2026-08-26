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
	return `${collection}/${encodeURIComponent(identifier)}` as DetailPath;
}
