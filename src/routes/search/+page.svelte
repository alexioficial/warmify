<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h1>Search</h1>
<form method="GET">
	<label>Search projects and resources <input type="search" name="q" value={data.query} /></label>
	<button type="submit">Search</button>
</form>

{#if data.query}
	<h2>Results</h2>
	{#if data.results.length}
		<ul>
			{#each data.results as result (`${result.group}:${result.item.uuid ?? result.item.id}`)}
				<li>
					<a
						href={resolve('/manage/[group]/[uuid]', {
							group: result.group,
							uuid: String(result.item.uuid ?? result.item.id)
						})}>{String(result.item.name ?? result.item.uuid ?? result.item.id)}</a
					>
					— {result.group}
				</li>
			{/each}
		</ul>
	{:else}<p>No matching resources.</p>{/if}
{/if}
