<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<h2>Validation</h2>
<p>
	Check SSH connectivity and the server prerequisites. Coolify performs this work asynchronously;
	refresh the server status after it finishes.
</p>
<form method="POST" action="?/validate" use:enhance>
	<label class="checkbox-field">
		<input type="checkbox" name="install" value="true" disabled={!ready} /> Install missing prerequisites
		and Docker. This can restart the Docker daemon.
	</label>
	<label class="checkbox-field">
		<input type="checkbox" name="confirmation" value="confirm" required disabled={!ready} /> I confirm
		that server validation may run remote commands.
	</label>
	<button class="primary" disabled={!ready}>Start validation</button>
</form>
