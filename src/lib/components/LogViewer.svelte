<script lang="ts">
	import { onMount } from 'svelte';
	import { logText } from '$lib/resource-presenter';

	let {
		initial,
		url,
		interval = 5000
	}: { initial: unknown; url?: string; interval?: number } = $props();
	let refreshed = $state<{ value: unknown }>();
	let data = $derived(refreshed ? refreshed.value : initial);
	let error = $state('');

	onMount(() => {
		if (!url) return;
		const refresh = async () => {
			if (document.hidden) return;
			try {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Log refresh failed (${response.status})`);
				refreshed = { value: await response.json() };
				error = '';
			} catch (caught) {
				error = caught instanceof Error ? caught.message : 'Log refresh failed';
			}
		};
		const timer = setInterval(refresh, interval);
		return () => clearInterval(timer);
	});
</script>

{#if error}<p class="error">{error}</p>{/if}
{#if logText(data)}
	<pre class="log-output">{logText(data)}</pre>
{:else}
	<p class="muted">No logs available.</p>
{/if}
