<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Service resource operations - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Resource operations</h2>
	{#if data.destinationError}<p class="error">{data.destinationError}</p>{/if}
	{#if data.environmentError}<p class="error">{data.environmentError}</p>{/if}
	{#each ['clone', 'move', 'migrate'] as operation (operation)}
		<details>
			<summary
				>{operation === 'clone'
					? 'Clone service'
					: operation === 'move'
						? 'Move to environment'
						: 'Migrate to server'}</summary
			>
			<form method="POST" action={`?/${operation}Service`}>
				{#if operation === 'move'}
					<label
						>Environment <select name="environment_uuid" required disabled={!ready}
							><option value="">Choose an environment</option
							>{#each data.environments as environment (environment.uuid)}<option
									value={environment.uuid}>{environment.projectName} / {environment.name}</option
								>{/each}</select
						></label
					>
				{:else}
					<label
						>Destination <select name="destination_uuid" required disabled={!ready}
							><option value="">Choose a destination</option
							>{#each data.destinations as destination (destination.uuid)}<option
									value={destination.uuid}>{destination.name}</option
								>{/each}</select
						></label
					>
					{#if operation === 'clone'}<label
							>New name (optional) <input name="name" disabled={!ready} /></label
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
					{data.serviceName} to confirm
					<input name="confirmation" required disabled={!ready} /></label
				>
				<button class={operation === 'migrate' ? 'danger' : 'primary'} disabled={!ready}
					>{operation === 'clone'
						? 'Clone service'
						: operation === 'move'
							? 'Move service'
							: 'Migrate service'}</button
				>
			</form>
		</details>
	{/each}
</section>
