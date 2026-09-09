<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	import DatabaseConnections from '$lib/components/DatabaseConnections.svelte';
	let { data, form } = $props();
</script>

<p class="muted">
	Blank passwords keep the existing value. Changes to initialization credentials do not necessarily
	update users in an existing data volume.
</p>
{#key data.uuid}<DatabaseConnections uuid={data.uuid} />{/key}
{#if data.configurationFields.some((field) => field.section === 'credentials')}
	{#key data.uuid}<ApplicationConfigurationSection
			application={data.database}
			configurationFields={data.configurationFields}
			title="Credentials"
			section="credentials"
			{form}
		/>{/key}
{:else}<p class="muted">This section is unavailable for this database engine.</p>{/if}
