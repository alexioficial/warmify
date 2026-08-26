<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();
	const hasData = $derived(Object.keys(data).length > 0);
</script>

{#if hasData}
	<details>
		<summary>Additional data</summary>
		<pre>{JSON.stringify(data, null, 2)}</pre>
	</details>
{/if}
