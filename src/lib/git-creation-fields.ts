import type { ConfigurationField } from './server/resource-groups';
export const gitKinds = ['public-repository', 'private-deploy-key', 'github-app'];
export const gitBuildPacks = ['railpack', 'nixpacks', 'static', 'dockerfile', 'dockercompose'];
export function gitCreationFields(kind: string, pack: string): ConfigurationField[] {
	const field = (
		name: string,
		label: string,
		section: string,
		extra: Partial<ConfigurationField> = {}
	): ConfigurationField => ({ name, label, section, ...extra });
	const command = (name: string, label: string) =>
		field(name, label, 'Build configuration', { sensitive: true });
	return [
		field('server_uuid', 'Server', 'Destination'),
		field('destination_uuid', 'Destination', 'Destination'),
		field('name', 'Name', 'General'),
		field('description', 'Description', 'General', { type: 'textarea' }),
		...(kind === 'private-deploy-key'
			? [field('private_key_uuid', 'Private key', 'Repository')]
			: []),
		...(kind === 'github-app' ? [field('github_app_uuid', 'GitHub App', 'Repository')] : []),
		field('git_repository', kind === 'github-app' ? 'Repository' : 'Repository URL', 'Repository'),
		field('git_branch', 'Branch', 'Repository'),
		field('build_pack', 'Build pack', 'Build configuration', {
			type: 'select',
			options: gitBuildPacks.map((value) => ({ value, label: value }))
		}),
		field('base_directory', 'Base directory', 'Build configuration'),
		...(pack === 'dockercompose'
			? [
					field('docker_compose_location', 'Compose file', 'Build configuration'),
					command('docker_compose_custom_build_command', 'Compose build command'),
					command('docker_compose_custom_start_command', 'Compose start command')
				]
			: [
					field('domains', 'Domains', 'Networking'),
					...(pack === 'static' ? [] : [field('ports_exposes', 'Exposed ports', 'Networking')]),
					field('autogenerate_domain', 'Generate a domain when blank', 'Networking', {
						type: 'checkbox',
						coerce: 'boolean'
					})
				]),
		...(pack === 'dockerfile'
			? [field('dockerfile_location', 'Dockerfile path', 'Build configuration')]
			: []),
		...(['railpack', 'nixpacks', 'static'].includes(pack)
			? [
					field('publish_directory', 'Publish directory', 'Build configuration'),
					command('install_command', 'Install command'),
					command('build_command', 'Build command'),
					...(pack === 'static'
						? []
						: [
								command('start_command', 'Start command'),
								field('is_static', 'Static output', 'Build configuration', {
									type: 'checkbox',
									coerce: 'boolean'
								})
							])
				]
			: []),
		field('instant_deploy', 'Deploy immediately', 'Create', { type: 'checkbox', coerce: 'boolean' })
	];
}
