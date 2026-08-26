<script lang="ts">
	import { resolve } from '$app/paths';
	import { deploymentSummary, formatTimestamp, normalizeRecords } from '$lib/resource-presenter';

	let { data }: { data: unknown } = $props();
	const deployments = $derived(normalizeRecords(data).map(deploymentSummary));

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ ·]/)[0]}`;
	}
</script>

{#if deployments.length}
	<table>
		<thead><tr><th>Resource</th><th>Status</th><th>Commit</th><th>Started</th></tr></thead>
		<tbody>
			{#each deployments as deployment, index (deployment.id || index)}
				<tr>
					<td>
						{#if deployment.id}<a
								href={resolve('/manage/[group]/[uuid]', {
									group: 'deployments',
									uuid: deployment.id
								})}>{deployment.name}</a
							>{:else}{deployment.name}{/if}
					</td>
					<td class={statusClass(deployment.status)}>{deployment.status}</td>
					<td>{deployment.message || '—'}</td>
					<td>{formatTimestamp(deployment.createdAt)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="muted">No active deployments.</p>
{/if}
