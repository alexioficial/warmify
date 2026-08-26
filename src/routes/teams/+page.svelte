<script lang="ts">
	import ResourceIndexPage from '$lib/components/ResourceIndexPage.svelte';

	let { data } = $props();
</script>

<ResourceIndexPage {data} />
