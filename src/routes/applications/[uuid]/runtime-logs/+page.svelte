<script lang="ts">
	import LogViewer from '$lib/components/LogViewer.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Runtime logs - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section>
	<h2>Runtime logs</h2>
	<LogViewer
		initial={data.logs}
		url={`/internal/poll/application-logs/${encodeURIComponent(data.uuid)}`}
	/>
</section>
