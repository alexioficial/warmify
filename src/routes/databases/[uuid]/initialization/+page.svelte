<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

<p class="muted">
	Initialization options apply when the data directory is first created. Initialization scripts
	cannot be edited through this public API.
</p>
{#if data.configurationFields.some((field) => field.section === 'initialization')}
	{#key data.uuid}<ApplicationConfigurationSection
			application={data.database}
			configurationFields={data.configurationFields}
			title="Initialization"
			section="initialization"
			{form}
		/>{/key}
{:else}<p class="muted">This section is unavailable for this database engine.</p>{/if}
