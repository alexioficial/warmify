<script lang="ts">
	import { resolve } from '$app/paths';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';
	import { detailPath } from '$lib/resource-routes';

	let {
		data,
		detailGroup,
		displayGroup,
		searchable = false
	}: {
		data: unknown;
		detailGroup?: string;
		displayGroup?: string;
		searchable?: boolean;
	} = $props();
	let query = $state('');
	const group = $derived(displayGroup ?? detailGroup ?? 'resources');
	const rows = $derived(
		normalizeRecords(data).map((record) => ({
			record,
			summary: resourceSummary(record, group)
		}))
	);
	const visibleRows = $derived(
		rows.filter((row) =>
			`${row.summary.name} ${row.summary.description} ${row.summary.context}`
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ -]/)[0]}`;
	}
</script>

{#if searchable}
	<div class="page-toolbar">
		<label class="visually-hidden" for={`${group}-search`}>Search {group}</label>
		<input
			id={`${group}-search`}
			type="search"
			placeholder={`Search ${group}`}
			bind:value={query}
		/>
		<span class="muted">{visibleRows.length} {group}</span>
	</div>
{/if}

{#if visibleRows.length}
	<div class="table-wrap">
		<table>
			<thead>
				{#if group === 'servers'}
					<tr><th scope="col">Server</th><th scope="col">Address</th><th scope="col">Status</th></tr
					>
				{:else if group === 'sources'}
					<tr
						><th scope="col">Source</th><th scope="col">Provider</th><th scope="col">Status</th></tr
					>
				{:else}
					<tr
						><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Status</th><th
							scope="col">Context</th
						></tr
					>
				{/if}
			</thead>
			<tbody>
				{#each visibleRows as row, rowIndex (row.summary.id || rowIndex)}
					<tr>
						<td>
							{#if row.summary.id && detailGroup}
								<a href={resolve(detailPath(detailGroup, row.summary.id) ?? '/')}
									>{row.summary.name}</a
								>
							{:else}{row.summary.name}{/if}
							{#if row.summary.description}<br /><small>{row.summary.description}</small>{/if}
						</td>
						{#if group === 'servers'}
							<td>{firstText(row.record, ['ip']) || '-'}</td>
							<td><span class={statusClass(row.summary.status)}>{row.summary.status}</span></td>
						{:else if group === 'sources'}
							<td>{firstText(row.record, ['provider', 'type']) || 'GitHub'}</td>
							<td><span class={statusClass(row.summary.status)}>{row.summary.status}</span></td>
						{:else}
							<td>{row.summary.type}</td>
							<td><span class={statusClass(row.summary.status)}>{row.summary.status}</span></td>
							<td>{row.summary.context || '-'}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No resources found.</p>
{/if}
