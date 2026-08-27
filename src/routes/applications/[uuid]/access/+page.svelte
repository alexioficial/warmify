<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data } = $props();
</script>
<ApplicationConfigurationSection application={data.application} configurationFields={data.configurationFields} title="Access" fields={['fqdn']} />
