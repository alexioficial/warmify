<script lang="ts">
	import ServiceSubresourcePage from '$lib/components/ServiceSubresourcePage.svelte';
	let { data, form } = $props();
</script>

<ServiceSubresourcePage {data} {form} />
