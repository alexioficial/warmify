<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	let force = $state(false);
	onMount(() => (ready = true));
</script>

<h2>Danger zone</h2>
{#if data.server.isCoolifyHost}
	<p>The local Coolify host cannot be deleted.</p>
{:else}
	<section class="danger-zone">
		<h3>Delete server</h3>
		<p>
			Permanently remove this server from Coolify. Without force, Coolify refuses deletion while
			managed resources remain.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<label
				>Type <strong>{data.server.name}</strong> or <strong>{data.server.uuid}</strong> to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready}
				/></label
			>
			<input type="hidden" name="force" value="false" />
			<label class="checkbox-field">
				<input type="checkbox" name="force" value="true" bind:checked={force} disabled={!ready} />
				Also delete every managed resource on this server.
			</label>
			{#if force}
				<label
					>Type <strong>DELETE ALL RESOURCES</strong> to confirm force deletion<input
						name="force_confirmation"
						autocomplete="off"
						required
						disabled={!ready}
					/></label
				>
			{/if}
			<button class="danger" disabled={!ready}>Delete server</button>
		</form>
	</section>
{/if}
