<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		ApplicationEnvironmentOption,
		ApplicationOperationOption
	} from '$lib/server/application-operations';

	interface PageData {
		applicationName: string;
		destinations: ApplicationOperationOption[];
		environments: ApplicationEnvironmentOption[];
		destinationError?: string;
		environmentError?: string;
	}

	let { data }: { data: PageData } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Resource operations - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Resource operations</h2>
	<p class="muted">
		Clone, move, or migrate {data.applicationName} using documented Coolify operations.
	</p>
	{#if data.destinationError}<p class="error">{data.destinationError}</p>{/if}
	{#if data.environmentError}<p class="error">{data.environmentError}</p>{/if}

	<details>
		<summary>Clone application</summary>
		<form method="POST" action="?/cloneApplication">
			<label>
				Destination
				<select name="destination_uuid" disabled={!ready} required>
					<option value="">Choose a destination</option>
					{#each data.destinations as destination (destination.uuid)}
						<option value={destination.uuid}>
							{destination.name}{destination.description ? ` — ${destination.description}` : ''}
						</option>
					{/each}
				</select>
			</label>
			<label>
				New name <span class="muted">(optional)</span>
				<input name="name" disabled={!ready} />
			</label>
			<label class="checkbox-field">
				<input type="hidden" name="clone_volumes" value="false" />
				<input type="checkbox" name="clone_volumes" value="true" disabled={!ready} />
				Clone persistent volume data
			</label>
			<label>
				Type clone {data.applicationName} to confirm
				<input name="confirmation" disabled={!ready} required />
			</label>
			<button class="primary" type="submit" disabled={!ready || !data.destinations.length}
				>Clone application</button
			>
		</form>
	</details>

	<details>
		<summary>Move to environment</summary>
		<form method="POST" action="?/moveApplication">
			<label>
				Environment
				<select name="environment_uuid" disabled={!ready} required>
					<option value="">Choose an environment</option>
					{#each data.environments as environment (environment.uuid)}
						<option value={environment.uuid}>{environment.projectName} / {environment.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Type move {data.applicationName} to confirm
				<input name="confirmation" disabled={!ready} required />
			</label>
			<button class="primary" type="submit" disabled={!ready || !data.environments.length}
				>Move application</button
			>
		</form>
	</details>

	<details>
		<summary>Migrate to server</summary>
		<p class="muted">
			Coolify currently exposes this endpoint only on installations where server migration is
			enabled.
		</p>
		<form method="POST" action="?/migrateApplication">
			<label>
				Destination
				<select name="destination_uuid" disabled={!ready} required>
					<option value="">Choose a destination</option>
					{#each data.destinations as destination (destination.uuid)}
						<option value={destination.uuid}>
							{destination.name}{destination.description ? ` — ${destination.description}` : ''}
						</option>
					{/each}
				</select>
			</label>
			<label class="checkbox-field">
				<input type="hidden" name="migrate_volumes" value="false" />
				<input type="checkbox" name="migrate_volumes" value="true" checked disabled={!ready} />
				Migrate persistent volume data
			</label>
			<label>
				Type migrate {data.applicationName} to confirm
				<input name="confirmation" disabled={!ready} required />
			</label>
			<button class="danger" type="submit" disabled={!ready || !data.destinations.length}
				>Migrate application</button
			>
		</form>
	</details>
</section>
