<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data } = $props();
</script>
<ApplicationConfigurationSection application={data.application} configurationFields={data.configurationFields} title="Build pipeline" fields={['git_repository', 'git_branch', 'base_directory', 'publish_directory', 'build_pack', 'install_command', 'build_command', 'start_command']} />
