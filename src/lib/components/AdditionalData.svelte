<script lang="ts">
	import { redactSecrets } from '$lib/redact';

	let { data }: { data: Record<string, unknown> } = $props();
	const safeData = $derived(redactSecrets(data));
	const hasData = $derived(Object.keys(data).length > 0);
</script>

{#if hasData}
	<details>
		<summary>Additional data</summary>
		<pre>{JSON.stringify(safeData, null, 2)}</pre>
	</details>
{/if}
