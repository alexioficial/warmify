<script lang="ts">
	import ApplicationConfigurationSection from '$lib/components/ApplicationConfigurationSection.svelte';
	let { data, form } = $props();
</script>

<p class="muted">
	Compose content is write-only in Warmify. Saving replaces the current Compose definition; leaving
	it blank keeps the existing definition.
</p>
<ApplicationConfigurationSection
	application={data.service}
	configurationFields={data.configurationFields}
	title="Docker Compose"
	section="compose"
	{form}
/>
