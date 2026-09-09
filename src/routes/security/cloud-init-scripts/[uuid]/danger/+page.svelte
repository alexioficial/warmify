<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p class="error">Deletion permanently removes this reusable script from Coolify.</p>
	<form method="POST" action="?/delete">
		<label
			>Type {data.script.name} or {data.script.uuid} to confirm<input
				name="confirmation"
				required
				autocomplete="off"
				disabled={!ready}
			/></label
		>
		<button class="danger" disabled={!ready}>Delete cloud-init script permanently</button>
	</form>
</section>
