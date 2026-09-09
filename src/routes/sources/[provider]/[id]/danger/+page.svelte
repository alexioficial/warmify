<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	{#if data.source.owned}
		<p class="error">Coolify refuses deletion while applications still use this source.</p>
		<form method="POST" action="?/delete">
			<label
				>Type {data.source.name} or {data.source.uuid} to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready}
				/></label
			>
			<button class="danger" disabled={!ready}>Delete source permanently</button>
		</form>
	{:else}
		<p>This shared source can only be changed by its owning team.</p>
	{/if}
</section>
