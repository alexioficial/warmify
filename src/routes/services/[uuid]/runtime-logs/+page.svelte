<script lang="ts">
	import { onMount } from 'svelte';
	import LogViewer from '$lib/components/LogViewer.svelte';
	let { data } = $props();
	let selectedTarget = $derived(data.selectedTarget);
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Service runtime logs - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Runtime logs</h2>
	<form method="GET">
		<label
			>Container <select name="sub_service_name" bind:value={selectedTarget} disabled={!ready}
				>{#each data.targets as target (target.name)}<option value={target.name}
						>{target.label} ({target.type})</option
					>{/each}</select
			></label
		>
		<button disabled={!ready || !data.targets.length}>Load logs</button>
	</form>
	{#key `${data.uuid}:${data.selectedTarget}`}
		<LogViewer
			initial={data.logs}
			initialError={data.requestFailure}
			url={data.selectedTarget
				? `/internal/poll/service-logs/${encodeURIComponent(data.uuid)}?sub_service_name=${encodeURIComponent(data.selectedTarget)}`
				: undefined}
		/>
	{/key}
</section>
