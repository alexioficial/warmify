<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p class="error">
		Deletion removes this destination from Coolify. Objects already stored in the bucket are not
		deleted, but backup schedules using it will stop writing to S3.
	</p>
	<form method="POST" action="?/delete">
		<label
			>Type {data.storage.name} or {data.storage.uuid} to confirm<input
				name="confirmation"
				autocomplete="off"
				required
				disabled={!ready}
			/></label
		>
		<button class="danger" disabled={!ready}>Delete S3 storage permanently</button>
	</form>
</section>
