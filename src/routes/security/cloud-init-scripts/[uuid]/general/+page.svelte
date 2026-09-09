<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section">
	<h2>General</h2>
	<form method="POST" action="?/update">
		<label
			>Name<input
				name="name"
				maxlength="255"
				required
				value={data.script.name}
				disabled={!ready}
			/></label
		>
		<label
			>Replace script content<textarea
				name="script"
				rows="16"
				placeholder="Leave blank to keep the existing content"
				disabled={!ready}></textarea></label
		>
		<p class="muted">
			Existing content cannot be revealed through Warmify. Leave this field blank to keep it
			unchanged.
		</p>
		<button class="primary" disabled={!ready}>Save script</button>
	</form>
</section>
