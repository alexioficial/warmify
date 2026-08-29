<script lang="ts">
	import { onMount } from 'svelte';
	import DeploymentTable from './DeploymentTable.svelte';

	let {
		initial,
		url,
		interval = 5000
	}: { initial: unknown; url: string; interval?: number } = $props();
	let data = $derived(initial);
	let error = $state('');

	onMount(() => {
		const refresh = async () => {
			if (document.hidden) return;
			try {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
				data = await response.json();
				error = '';
			} catch (caught) {
				error = caught instanceof Error ? caught.message : 'Refresh failed';
			}
		};
		const timer = setInterval(refresh, interval);
		return () => clearInterval(timer);
	});
</script>

{#if error}<p class="error">{error}</p>{/if}
<DeploymentTable {data} />
