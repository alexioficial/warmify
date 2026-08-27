export interface ResourceGroupConfig {
	title: string;
	listPath: string;
	detailPath?: string;
	configurationFields?: ReadonlyArray<{
		name: string;
		label: string;
		type?: 'text' | 'url' | 'number' | 'textarea';
	}>;
}

export const resourceGroups: Record<string, ResourceGroupConfig> = {
	projects: {
		title: 'Projects',
		listPath: '/projects',
		detailPath: '/projects/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' }
		]
	},
	applications: {
		title: 'Applications',
		listPath: '/applications',
		detailPath: '/applications/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' },
			{ name: 'fqdn', label: 'Domains' },
			{ name: 'git_repository', label: 'Git repository', type: 'url' },
			{ name: 'git_branch', label: 'Branch' },
			{ name: 'base_directory', label: 'Base directory' },
			{ name: 'publish_directory', label: 'Publish directory' },
			{ name: 'build_pack', label: 'Build pack' },
			{ name: 'install_command', label: 'Install command' },
			{ name: 'build_command', label: 'Build command' },
			{ name: 'start_command', label: 'Start command' },
			{ name: 'ports_exposes', label: 'Exposed ports' },
			{ name: 'health_check_path', label: 'Health check path' }
		]
	},
	services: {
		title: 'Services',
		listPath: '/services',
		detailPath: '/services/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' },
			{ name: 'docker_compose', label: 'Docker Compose', type: 'textarea' }
		]
	},
	databases: {
		title: 'Databases',
		listPath: '/databases',
		detailPath: '/databases/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' },
			{ name: 'image', label: 'Docker image' },
			{ name: 'public_port', label: 'Public port', type: 'number' }
		]
	},
	servers: {
		title: 'Servers',
		listPath: '/servers',
		detailPath: '/servers/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' },
			{ name: 'ip', label: 'IP address' },
			{ name: 'port', label: 'SSH port', type: 'number' },
			{ name: 'user', label: 'SSH user' }
		]
	},
	deployments: {
		title: 'Deployments',
		listPath: '/deployments',
		detailPath: '/deployments/{uuid}'
	},
	destinations: {
		title: 'Destinations',
		listPath: '/destinations',
		detailPath: '/destinations/{uuid}',
		configurationFields: [{ name: 'name', label: 'Name' }]
	},
	sources: { title: 'Sources', listPath: '/github-apps' },
	storage: {
		title: 'S3 storage',
		listPath: '/s3-storages',
		detailPath: '/s3-storages/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'endpoint', label: 'Endpoint', type: 'url' },
			{ name: 'bucket', label: 'Bucket' },
			{ name: 'region', label: 'Region' }
		]
	},
	security: {
		title: 'Private keys',
		listPath: '/security/keys',
		detailPath: '/security/keys/{uuid}',
		configurationFields: [
			{ name: 'name', label: 'Name' },
			{ name: 'description', label: 'Description', type: 'textarea' }
		]
	},
	teams: { title: 'Teams', listPath: '/teams', detailPath: '/teams/{uuid}' },
	resources: { title: 'Resource inventory', listPath: '/resources' },
	system: { title: 'System', listPath: '/version' }
};
