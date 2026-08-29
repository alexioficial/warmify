export type ConfigurationFieldType =
	'text' | 'url' | 'number' | 'textarea' | 'checkbox' | 'password' | 'select';

export interface ConfigurationField {
	name: string;
	label: string;
	type?: ConfigurationFieldType;
	section?: string;
	coerce?: 'boolean' | 'integer' | 'base64' | 'json';
	nullable?: boolean;
	sensitive?: boolean;
	min?: number;
	max?: number;
	options?: ReadonlyArray<{ value: string; label: string }>;
}

export interface ResourceGroupConfig {
	title: string;
	listPath: string;
	detailPath?: string;
	configurationFields?: ReadonlyArray<ConfigurationField>;
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
			{ name: 'name', label: 'Name', section: 'application-details' },
			{
				name: 'description',
				label: 'Description',
				type: 'textarea',
				section: 'application-details'
			},
			{
				name: 'build_pack',
				label: 'Build pack',
				type: 'select',
				section: 'build-pipeline',
				options: [
					{ value: 'railpack', label: 'Railpack' },
					{ value: 'nixpacks', label: 'Nixpacks' },
					{ value: 'static', label: 'Static' },
					{ value: 'dockerfile', label: 'Dockerfile' },
					{ value: 'dockercompose', label: 'Docker Compose' }
				]
			},
			{
				name: 'is_static',
				label: 'Static application',
				type: 'checkbox',
				section: 'build-pipeline',
				coerce: 'boolean'
			},
			{
				name: 'is_spa',
				label: 'Single-page application',
				type: 'checkbox',
				section: 'build-pipeline',
				coerce: 'boolean'
			},
			{ name: 'static_image', label: 'Static image', section: 'build-pipeline' },
			{ name: 'install_command', label: 'Install command', section: 'build-pipeline' },
			{ name: 'build_command', label: 'Build command', section: 'build-pipeline' },
			{ name: 'start_command', label: 'Start command', section: 'build-pipeline' },
			{ name: 'base_directory', label: 'Base directory', section: 'build-pipeline' },
			{ name: 'publish_directory', label: 'Publish directory', section: 'build-pipeline' },
			{ name: 'watch_paths', label: 'Watch paths', type: 'textarea', section: 'build-pipeline' },
			{ name: 'dockerfile_location', label: 'Dockerfile location', section: 'build-pipeline' },
			{ name: 'dockerfile_target_build', label: 'Docker target stage', section: 'build-pipeline' },
			{
				name: 'docker_compose_location',
				label: 'Compose file location',
				section: 'build-pipeline'
			},
			{
				name: 'docker_compose_custom_start_command',
				label: 'Compose start command',
				section: 'build-pipeline'
			},
			{
				name: 'docker_compose_custom_build_command',
				label: 'Compose build command',
				section: 'build-pipeline'
			},
			{
				name: 'docker_compose_domains',
				label: 'Compose domains (JSON)',
				type: 'textarea',
				section: 'build-pipeline',
				coerce: 'json',
				nullable: true
			},
			{
				name: 'custom_nginx_configuration',
				label: 'Custom Nginx configuration',
				type: 'textarea',
				section: 'build-pipeline',
				coerce: 'base64'
			},
			{
				name: 'use_build_server',
				label: 'Use build server',
				type: 'checkbox',
				section: 'build-pipeline',
				coerce: 'boolean'
			},
			{
				name: 'use_build_secrets',
				label: 'Use build secrets',
				type: 'checkbox',
				section: 'build-pipeline',
				coerce: 'boolean'
			},
			{
				name: 'is_preserve_repository_enabled',
				label: 'Preserve repository',
				type: 'checkbox',
				section: 'build-pipeline',
				coerce: 'boolean'
			},
			{ name: 'docker_registry_image_name', label: 'Image name', section: 'container-image' },
			{ name: 'docker_registry_image_tag', label: 'Image tag', section: 'container-image' },
			{ name: 'ports_exposes', label: 'Exposed ports', section: 'networking' },
			{ name: 'ports_mappings', label: 'Port mappings', section: 'networking' },
			{ name: 'custom_network_aliases', label: 'Network aliases', section: 'networking' },
			{
				name: 'connect_to_docker_network',
				label: 'Connect to predefined Docker network',
				type: 'checkbox',
				section: 'networking',
				coerce: 'boolean'
			},
			{
				name: 'custom_docker_run_options',
				label: 'Custom Docker run options',
				type: 'textarea',
				section: 'runtime'
			},
			{
				name: 'max_restart_count',
				label: 'Maximum restart count',
				type: 'number',
				section: 'runtime',
				coerce: 'integer',
				min: 0
			},
			{
				name: 'stop_grace_period',
				label: 'Stop grace period (seconds)',
				type: 'number',
				section: 'runtime',
				coerce: 'integer',
				nullable: true,
				min: 1,
				max: 3600
			},
			{
				name: 'is_consistent_container_name_enabled',
				label: 'Consistent container name',
				type: 'checkbox',
				section: 'runtime',
				coerce: 'boolean'
			},
			{ name: 'custom_internal_name', label: 'Custom internal name', section: 'runtime' },
			{
				name: 'is_http_basic_auth_enabled',
				label: 'Enable HTTP basic auth',
				type: 'checkbox',
				section: 'security',
				coerce: 'boolean'
			},
			{ name: 'http_basic_auth_username', label: 'HTTP basic auth username', section: 'security' },
			{
				name: 'http_basic_auth_password',
				label: 'HTTP basic auth password',
				type: 'password',
				section: 'security',
				sensitive: true
			},
			{
				name: 'pre_deployment_command',
				label: 'Pre-deployment command',
				type: 'textarea',
				section: 'deployment-lifecycle'
			},
			{
				name: 'pre_deployment_command_container',
				label: 'Pre-deployment container',
				section: 'deployment-lifecycle'
			},
			{
				name: 'post_deployment_command',
				label: 'Post-deployment command',
				type: 'textarea',
				section: 'deployment-lifecycle'
			},
			{
				name: 'post_deployment_command_container',
				label: 'Post-deployment container',
				section: 'deployment-lifecycle'
			},
			{
				name: 'custom_labels',
				label: 'Custom labels',
				type: 'textarea',
				section: 'container-labels',
				coerce: 'base64'
			},
			{
				name: 'is_container_label_escape_enabled',
				label: 'Escape special characters',
				type: 'checkbox',
				section: 'container-labels',
				coerce: 'boolean'
			},
			{ name: 'health_check_path', label: 'Health check path', section: 'healthcheck' }
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
