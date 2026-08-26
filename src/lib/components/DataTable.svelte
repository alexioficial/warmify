<script lang="ts">
	import { resolve } from '$app/paths';
	import { normalizeRecords, resourceSummary } from '$lib/resource-presenter';

	let { data, detailGroup }: { data: unknown; detailGroup?: string } = $props();
	const rows = $derived(
		normalizeRecords(data).map((record) => ({
			record,
			summary: resourceSummary(record, detailGroup ?? 'resources')
		}))
	);

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ ·]/)[0]}`;
	}
</script>

{#if rows.length}
	<table>
		<thead>
			<tr><th>Name</th><th>Type</th><th>Status</th><th>Context</th></tr>
		</thead>
		<tbody>
			{#each rows as row, rowIndex (row.summary.id || rowIndex)}
				<tr>
					<td>
						{#if row.summary.id && detailGroup}
							<a
								href={resolve('/manage/[group]/[uuid]', {
									group: detailGroup,
									uuid: row.summary.id
								})}>{row.summary.name}</a
							>
						{:else}{row.summary.name}{/if}
						{#if row.summary.description}<br /><small>{row.summary.description}</small>{/if}
					</td>
					<td>{row.summary.type}</td>
					<td class={statusClass(row.summary.status)}>{row.summary.status}</td>
					<td>{row.summary.context || '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="muted">No resources found.</p>
{/if}
