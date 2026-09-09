<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import { detailPath } from '$lib/resource-routes';

	let { data } = $props();
	let refreshed = $state<typeof data.results>();
	const results = $derived(refreshed ?? data.results);
</script>

<h1>Search</h1>
<form method="GET">
	<label>Search projects and resources <input type="search" name="q" value={data.query} /></label>
	<button type="submit">Search</button>
</form>

{#if data.query}
	<CollectionSynchronizer
		url={`/internal/poll/search?q=${encodeURIComponent(data.query)}`}
		initialUpdatedAt={data.sync?.updatedAt}
		initialStale={data.sync?.stale}
		onValue={(value) => (refreshed = Array.isArray(value) ? (value as typeof data.results) : [])}
	/>
{/if}

{#if data.query}
	<h2>Results</h2>
	{#if results.length}
		<ul>
			{#each results as result (`${result.group}:${result.item.uuid ?? result.item.id}`)}
				<li>
					<a
						href={resolve(
							detailPath(result.group, String(result.item.uuid ?? result.item.id)) ?? '/'
						)}>{String(result.item.name ?? result.item.uuid ?? result.item.id)}</a
					>
					- {result.group}
				</li>
			{/each}
		</ul>
	{:else}<p>No matching resources.</p>{/if}
{/if}
