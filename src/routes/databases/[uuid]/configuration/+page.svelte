<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

<p class="muted">
	Configuration is write-only. Paste the complete replacement document; leaving it empty keeps the
	existing configuration.
</p>
{#if data.configurationFields.some((field) => field.section === 'configuration')}
	{#key data.uuid}<ApplicationConfigurationSection
			application={data.database}
			configurationFields={data.configurationFields}
			title="Configuration"
			section="configuration"
			{form}
		/>{/key}
{:else}<p class="muted">This section is unavailable for this database engine.</p>{/if}
