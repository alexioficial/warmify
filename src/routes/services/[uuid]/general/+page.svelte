<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

{#if data.overview}
	<section class="settings-section">
		<h2>Service overview</h2>
		<dl>
			<dt>Type</dt>
			<dd>{data.overview.type}</dd>
			<dt>Server</dt>
			<dd>{data.overview.server}</dd>
			<dt>Destination</dt>
			<dd>{data.overview.destination}</dd>
			<dt>Containers</dt>
			<dd>{data.overview.applications} applications · {data.overview.databases} databases</dd>
		</dl>
	</section>
{/if}

<ApplicationConfigurationSection
	application={data.service}
	configurationFields={data.configurationFields}
	title="General"
	section="general"
	{form}
/>
