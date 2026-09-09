<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	{#if data.token.serversCount > 0}
		<p class="error">
			This token is used by {data.token.serversCount} server{data.token.serversCount === 1
				? ''
				: 's'}. Move or delete those servers before removing the token.
		</p>
	{:else}
		<p class="error">Deletion removes the stored provider credential from Coolify permanently.</p>
	{/if}
	<form method="POST" action="?/delete">
		<label
			>Type {data.token.name} or {data.token.uuid} to confirm<input
				name="confirmation"
				required
				autocomplete="off"
				disabled={!ready || data.token.serversCount > 0}
			/></label
		>
		<button class="danger" disabled={!ready || data.token.serversCount > 0}
			>Delete cloud token permanently</button
		>
	</form>
</section>
