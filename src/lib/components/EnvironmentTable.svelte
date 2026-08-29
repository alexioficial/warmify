<script lang="ts">
	import { environmentVariableSummary, normalizeRecords } from '$lib/resource-presenter';

	let { data }: { data: unknown } = $props();
	const variables = $derived(normalizeRecords(data).map(environmentVariableSummary));
</script>

{#if variables.length}
	<table>
		<thead><tr><th>Key</th><th>Value</th><th>Scope</th></tr></thead>
		<tbody>
			{#each variables as variable, index (variable.id || index)}
				<tr>
					<td><code>{variable.key}</code></td>
					<td><code>{variable.value}</code></td>
					<td>{variable.scope}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="muted">No environment variables.</p>
{/if}
