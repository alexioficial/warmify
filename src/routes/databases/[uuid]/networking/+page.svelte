<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

<p class="muted">
	Public access exposes the database through the server. Restrict access at the firewall and use
	strong credentials.
</p>
{#if data.configurationFields.some((field) => field.section === 'networking')}
	{#key data.uuid}<ApplicationConfigurationSection
			application={data.database}
			configurationFields={data.configurationFields}
			title="Networking"
			section="networking"
			{form}
		/>{/key}
{:else}<p class="muted">This section is unavailable for this database engine.</p>{/if}
