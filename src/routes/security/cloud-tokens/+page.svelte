<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import {
		cloudProviderLabel,
		cloudTokenCollection,
		type CloudTokenView
	} from '$lib/cloud-security-presenter';

	let { data } = $props();
	let query = $state('');
	let refreshed = $state<CloudTokenView[]>();
	const tokens = $derived(refreshed ?? data.tokens);
	const filtered = $derived(
		tokens.filter((token) =>
			[token.name, cloudProviderLabel(token.provider)]
				.join(' ')
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
</script>

<svelte:head><title>Cloud tokens - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Cloud tokens</h1>
		<p class="muted">Provider credentials used to provision cloud servers.</p>
	</div>
	<a class="button primary" href={resolve('/security/cloud-tokens/new')}>New cloud token</a>
</div>
<CollectionSynchronizer
	url="/internal/poll/collections/cloud-tokens"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = cloudTokenCollection(value))}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<div class="page-toolbar">
	<label class="visually-hidden" for="cloud-token-search">Search cloud tokens</label>
	<input
		id="cloud-token-search"
		type="search"
		placeholder="Search cloud tokens"
		bind:value={query}
	/>
</div>
{#if filtered.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead><tr><th>Name</th><th>Provider</th><th>Servers</th></tr></thead>
			<tbody>
				{#each filtered as token (token.uuid)}
					<tr>
						<td
							><a href={resolve(`/security/cloud-tokens/${token.uuid}/general` as '/')}
								>{token.name}</a
							></td
						>
						<td>{cloudProviderLabel(token.provider)}</td>
						<td>{token.serversCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if query}<p>No cloud tokens match your search.</p>{:else}<p>
		No cloud tokens configured yet.
	</p>{/if}
