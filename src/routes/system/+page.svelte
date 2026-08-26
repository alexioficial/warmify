<script lang="ts">
	import ResourceIndexPage from '$lib/components/ResourceIndexPage.svelte';

	let { data, form } = $props();
</script>

<ResourceIndexPage {data} {form} />
