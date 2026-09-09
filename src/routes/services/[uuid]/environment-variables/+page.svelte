<script lang="ts">
	import ResourceEnvironmentVariables from '$lib/components/ResourceEnvironmentVariables.svelte';
	let { data, form } = $props();
</script>

{#key data.uuid}<ResourceEnvironmentVariables {data} {form} />{/key}
