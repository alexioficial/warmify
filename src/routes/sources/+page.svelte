<script lang="ts">
	import { resolve } from '$app/paths';
	import { sourceCollection, type SourceView } from '$lib/source-presenter';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';

	let { data } = $props();
	let query = $state('');
	let refreshed = $state<SourceView[]>();
	const sources = $derived(refreshed ?? data.sources);
	const filtered = $derived(
		sources.filter((source) => {
			const needle = query.trim().toLowerCase();
			return (
				!needle ||
				[source.name, source.provider, source.organization, source.groupName, source.htmlUrl]
					.join(' ')
					.toLowerCase()
					.includes(needle)
			);
		})
	);
</script>

<svelte:head><title>Sources - Warmify</title></svelte:head>

<div class="page-header">
	<div>
		<h1>Sources</h1>
		<p class="muted">Git providers connected to your Coolify instance.</p>
	</div>
	<div class="actions">
		<a class="button" href={resolve('/sources/new/gitlab')}>New GitLab App</a>
		<a class="button primary" href={resolve('/sources/new/github')}>New GitHub App</a>
	</div>
</div>

<CollectionSynchronizer
	url="/internal/poll/collections/sources"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = sourceCollection(value))}
/>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}

<div class="page-toolbar">
	<label class="visually-hidden" for="source-search">Search sources</label>
	<input id="source-search" type="search" placeholder="Search sources" bind:value={query} />
</div>

{#if filtered.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead><tr><th>Name</th><th>Provider</th><th>Scope</th><th>Address</th></tr></thead>
			<tbody>
				{#each filtered as source (`${source.provider}:${source.id}`)}
					<tr>
						<td>
							<a href={resolve(`/sources/${source.provider}/${source.id}/general` as '/')}
								>{source.name}</a
							>
						</td>
						<td>{source.provider === 'github' ? 'GitHub App' : 'GitLab App'}</td>
						<td>{source.isSystemWide ? 'System-wide' : 'Team'}</td>
						<td>{source.htmlUrl || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if query}
	<p>No sources match your search.</p>
{:else}
	<p>No Git sources connected yet.</p>
{/if}
