<script lang="ts">
	import { resolve } from '$app/paths';
	import { deploymentSummary, formatRelativeTime, normalizeRecords } from '$lib/resource-presenter';
	import { detailPath } from '$lib/resource-routes';

	let { data }: { data: unknown } = $props();
	const deployments = $derived(normalizeRecords(data).map(deploymentSummary));

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ ·]/)[0]}`;
	}
</script>

{#if deployments.length}
	<div class="table-wrap">
		<table>
			<thead
				><tr
					><th>Application</th><th>Environment</th><th>Server</th><th>Status</th><th>Started</th
					></tr
				></thead
			>
			<tbody>
				{#each deployments as deployment, index (deployment.id || index)}
					<tr>
						<td>
							{#if deployment.id}<a
									href={resolve(detailPath('deployments', deployment.id) ?? '/deployments')}
									>{deployment.name}</a
								>{:else}{deployment.name}{/if}
							{#if deployment.message}<br /><small>{deployment.message}</small>{/if}
						</td>
						<td>{deployment.environment || '—'}</td>
						<td>{deployment.server || '—'}</td>
						<td><span class={statusClass(deployment.status)}>{deployment.status}</span></td>
						<td>{formatRelativeTime(deployment.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No active deployments.</p>
{/if}
