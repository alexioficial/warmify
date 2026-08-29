<script lang="ts">
	import ResourceDetailPage from '$lib/components/ResourceDetailPage.svelte';

	let { data } = $props();
</script>

<ResourceDetailPage {data} />
