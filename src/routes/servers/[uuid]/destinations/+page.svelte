<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let ready = $state(false);
	let query = $state('');
	onMount(() => (ready = true));
	const rows = $derived(
		data.destinations.filter((destination) =>
			`${destination.name} ${destination.network}`
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
</script>

<svelte:head><title>Server destinations - Warmify</title></svelte:head>
<div class="section-heading">
	<div>
		<h2>Destinations</h2>
		<p class="muted">Docker networks available for deployments on this server.</p>
	</div>
	<details {...form?.error ? { open: true } : {}}>
		<summary class="button primary">New destination</summary>
		<form method="POST" action="?/createDestination">
			<label
				>Name<input
					name="name"
					maxlength="255"
					value={form?.values?.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Docker network<input
					name="network"
					required
					maxlength="255"
					placeholder="deployment-network"
					value={form?.values?.network ?? ''}
					disabled={!ready}
				/></label
			>
			<p class="muted">The destination type is chosen automatically from the server mode.</p>
			<button class="primary" disabled={!ready || !data.server.isUsable}>Create destination</button>
		</form>
	</details>
</div>
{#if !data.server.isUsable}<p class="error" role="alert">
		Validate this server before creating destinations.
	</p>{/if}
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}

<div class="page-toolbar">
	<label class="visually-hidden" for="destination-search">Search destinations</label>
	<input
		id="destination-search"
		type="search"
		placeholder="Search destinations"
		bind:value={query}
	/>
	<span class="muted">{rows.length} destinations</span>
</div>
{#if rows.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead><tr><th>Destination</th><th>Network</th><th>Type</th></tr></thead>
			<tbody>
				{#each rows as destination (destination.uuid)}
					<tr>
						<td
							><a href={resolve(`/destinations/${destination.uuid}/general`)}>{destination.name}</a
							></td
						>
						<td>{destination.network || '-'}</td>
						<td>{destination.type}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No destinations found for this server.</p>
{/if}
