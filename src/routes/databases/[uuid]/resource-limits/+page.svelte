<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

{#if data.configurationFields.some((field) => field.section === 'resource-limits')}
	{#key data.uuid}<ApplicationConfigurationSection
			application={data.database}
			configurationFields={data.configurationFields}
			title="Resource limits"
			section="resource-limits"
			{form}
		/>{/key}
{:else}<p class="muted">This section is unavailable for this database engine.</p>{/if}
