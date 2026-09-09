<script lang="ts">
	import LogViewer from '$lib/components/LogViewer.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Runtime logs - {data.applicationName} - Warmify</title></svelte:head>
<section>
	<h2>Runtime logs</h2>
	<p class="muted">Choose a bounded tail and refresh automatically while this tab is visible.</p>
	<LogViewer
		initial={data.logs}
		url={`/internal/poll/application-logs/${encodeURIComponent(data.uuid)}`}
		initialError={data.requestFailure}
	/>
</section>
