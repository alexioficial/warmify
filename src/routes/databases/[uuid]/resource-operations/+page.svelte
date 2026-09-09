<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Database resource operations - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Resource operations</h2>
	{#if data.destinationError}<p class="error">{data.destinationError}</p>{/if}
	{#if data.environmentError}<p class="error">{data.environmentError}</p>{/if}
	{#each ['clone', 'move', 'migrate'] as operation (operation)}
		<details>
			<summary
				>{operation === 'clone'
					? 'Clone database'
					: operation === 'move'
						? 'Move to environment'
						: 'Migrate to server'}</summary
			>
			{#if operation === 'clone'}
				<p class="muted">
					Creates a stopped copy in the selected destination. Volume contents are copied only if
					selected; start the copy after the operation completes.
				</p>
			{:else if operation === 'move'}
				<p class="muted">
					Changes the project/environment association without moving the database to a different
					server.
				</p>
			{:else}
				<p class="muted">
					Migration stops the database. Start it after migration completes. The reference Coolify
					version restricts this API to development mode; other installations may report it as
					unavailable.
				</p>
			{/if}
			<form method="POST" action={`?/${operation}Database`}>
				{#if operation === 'move'}
					<label
						>Environment <select
							name="environment_uuid"
							required
							disabled={!ready || !data.environments.length}
						>
							<option value="">Choose an environment</option>
							{#each data.environments as environment (environment.uuid)}<option
									value={environment.uuid}>{environment.projectName} / {environment.name}</option
								>{/each}
						</select></label
					>
					{#if !data.environments.length}<p class="muted">No environments available.</p>{/if}
				{:else}
					<label
						>Destination <select
							name="destination_uuid"
							required
							disabled={!ready || !data.destinations.length}
						>
							<option value="">Choose a destination</option>
							{#each data.destinations as destination (destination.uuid)}<option
									value={destination.uuid}>{destination.name}</option
								>{/each}
						</select></label
					>
					{#if !data.destinations.length}<p class="muted">No destinations available.</p>{/if}
					{#if operation === 'clone'}<label
							>New name (optional) <input name="name" maxlength="255" disabled={!ready} /></label
						>{/if}
					<label class="checkbox-field"
						><input type="hidden" name={`${operation}_volumes`} value="false" /><input
							type="checkbox"
							name={`${operation}_volumes`}
							value="true"
							checked={operation === 'migrate'}
							disabled={!ready}
						/>Transfer persistent volume data</label
					>
				{/if}
				<label
					>Type {operation}
					{data.databaseName} to confirm
					<input name="confirmation" required disabled={!ready} /></label
				>
				<button
					class={operation === 'migrate' ? 'danger' : 'primary'}
					disabled={!ready ||
						(operation === 'move' ? !data.environments.length : !data.destinations.length)}
					>{operation === 'clone'
						? 'Clone database'
						: operation === 'move'
							? 'Move database'
							: 'Migrate database'}</button
				>
			</form>
		</details>
	{/each}
</section>
