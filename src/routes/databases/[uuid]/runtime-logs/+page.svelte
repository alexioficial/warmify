<script lang="ts">
	import LogViewer from '$lib/components/LogViewer.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Database runtime logs - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Runtime logs</h2>
	{#key data.uuid}<LogViewer
			initial={data.logs}
			initialError={data.requestFailure}
			url={`/internal/poll/database-logs/${encodeURIComponent(data.uuid)}`}
		/>{/key}
</section>
