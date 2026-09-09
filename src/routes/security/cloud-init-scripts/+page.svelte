<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import {
		cloudInitScriptCollection,
		type CloudInitScriptView
	} from '$lib/cloud-security-presenter';
	import { formatTimestamp } from '$lib/resource-presenter';

	let { data } = $props();
	let query = $state('');
	let refreshed = $state<CloudInitScriptView[]>();
	const scripts = $derived(refreshed ?? data.scripts);
	const filtered = $derived(
		scripts.filter((script) => script.name.toLowerCase().includes(query.trim().toLowerCase()))
	);
</script>

<svelte:head><title>Cloud-init scripts - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Cloud-init scripts</h1>
		<p class="muted">Reusable initialization scripts for cloud servers.</p>
	</div>
	<a class="button primary" href={resolve('/security/cloud-init-scripts/new')}>New script</a>
</div>
<CollectionSynchronizer
	url="/internal/poll/collections/cloud-init-scripts"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = cloudInitScriptCollection(value))}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<div class="page-toolbar">
	<label class="visually-hidden" for="cloud-init-search">Search cloud-init scripts</label>
	<input
		id="cloud-init-search"
		type="search"
		placeholder="Search cloud-init scripts"
		bind:value={query}
	/>
</div>
{#if filtered.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead><tr><th>Name</th><th>Last updated</th></tr></thead>
			<tbody>
				{#each filtered as script (script.uuid)}
					<tr>
						<td
							><a href={resolve(`/security/cloud-init-scripts/${script.uuid}/general` as '/')}
								>{script.name}</a
							></td
						>
						<td>{formatTimestamp(script.updatedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if query}<p>No scripts match your search.</p>{:else}<p>
		No cloud-init scripts configured yet.
	</p>{/if}
