<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		ApplicationDestinationSummary,
		ApplicationOperationOption
	} from '$lib/server/application-operations';

	interface PageData {
		destinations: ApplicationDestinationSummary[];
		availableDestinations: ApplicationOperationOption[];
		requestError?: string;
	}

	let { data }: { data: PageData } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Servers - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<h2>Servers</h2>
	<p class="muted">Manage the primary and additional deployment destinations.</p>
	{#if data.destinations.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Destination</th><th>Network</th><th>Role</th><th>Action</th></tr></thead>
				<tbody>
					{#each data.destinations as destination (destination.uuid)}
						<tr>
							<td><strong>{destination.name}</strong><br /><small>{destination.uuid}</small></td>
							<td>{destination.network || 'Default network'}</td>
							<td>{destination.isPrimary ? 'Primary' : 'Additional'}</td>
							<td>
								{#if destination.isPrimary}
									<span class="muted">Cannot be removed</span>
								{:else}
									<details>
										<summary>Remove</summary>
										<form method="POST" action="?/removeDestination">
											<input type="hidden" name="destination_uuid" value={destination.uuid} />
											<label>
												Type {destination.name} to confirm
												<input name="confirmation" disabled={!ready} required />
											</label>
											<button class="danger" type="submit" disabled={!ready}
												>Remove destination</button
											>
										</form>
									</details>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">No destinations were returned.</p>
	{/if}

	<details>
		<summary>Add destination</summary>
		<form method="POST" action="?/addDestination">
			<label>
				Destination
				<select name="destination_uuid" disabled={!ready} required>
					<option value="">Choose a destination</option>
					{#each data.availableDestinations as destination (destination.uuid)}
						<option value={destination.uuid}>
							{destination.name}{destination.description ? ` — ${destination.description}` : ''}
						</option>
					{/each}
				</select>
			</label>
			<button class="primary" type="submit" disabled={!ready || !data.availableDestinations.length}>
				Attach destination
			</button>
		</form>
	</details>
</section>
