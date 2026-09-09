<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const isDefault = $derived(data.destination.network === 'coolify');
</script>

<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	{#if isDefault}
		<p class="error">The default Coolify destination cannot be deleted.</p>
	{:else}
		<p class="error">
			Deletion removes this Docker network. It is only allowed after every resource is detached.
		</p>
		<form method="POST" action="?/delete">
			<label
				>Type {data.destination.name} or {data.uuid} to confirm
				<input name="confirmation" autocomplete="off" required disabled={!ready} /></label
			>
			<button class="danger" disabled={!ready}>Delete destination permanently</button>
		</form>
	{/if}
</section>
