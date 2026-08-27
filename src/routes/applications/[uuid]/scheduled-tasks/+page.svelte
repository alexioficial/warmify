<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	let { data } = $props();
</script>
<svelte:head><title>Scheduled tasks - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section><h2>Scheduled tasks</h2><DataTable data={data.tasks} /></section>
