<script lang="ts">
	import { resolve } from '$app/paths';
	import { privateKeyCollection, type PrivateKeyView } from '$lib/administration-presenter';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';

	let { data } = $props();
	let query = $state('');
	let refreshed = $state<PrivateKeyView[]>();
	const keys = $derived(refreshed ?? data.keys);
	const filtered = $derived(
		keys.filter((key) =>
			[key.name, key.description, key.fingerprint]
				.join(' ')
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
</script>

<svelte:head><title>Private keys - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Private keys</h1>
		<p class="muted">SSH credentials used by servers, applications, and Git integrations.</p>
	</div>
	<a class="button primary" href={resolve('/security/keys/new')}>New private key</a>
</div>
<CollectionSynchronizer
	url="/internal/poll/collections/security"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = privateKeyCollection(value))}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<div class="page-toolbar">
	<label class="visually-hidden" for="private-key-search">Search private keys</label>
	<input
		id="private-key-search"
		type="search"
		placeholder="Search private keys"
		bind:value={query}
	/>
</div>
{#if filtered.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead><tr><th>Name</th><th>Description</th><th>Fingerprint</th></tr></thead>
			<tbody>
				{#each filtered as key (key.uuid)}
					<tr>
						<td><a href={resolve(`/security/keys/${key.uuid}` as '/')}>{key.name}</a></td>
						<td>{key.description || '—'}</td>
						<td><code>{key.fingerprint || 'Unavailable'}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if query}<p>No private keys match your search.</p>{:else}<p>
		No private keys configured yet.
	</p>{/if}
