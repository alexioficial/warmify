<script lang="ts">
	import ResourceDetailPage from '$lib/components/ResourceDetailPage.svelte';

	let { data, form } = $props();
</script>

<ResourceDetailPage {data} {form} />
