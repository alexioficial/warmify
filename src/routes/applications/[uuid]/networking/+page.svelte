<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

<ApplicationConfigurationSection
	application={data.application}
	configurationFields={data.configurationFields}
	title="Networking"
	section="networking"
	{form}
/>
