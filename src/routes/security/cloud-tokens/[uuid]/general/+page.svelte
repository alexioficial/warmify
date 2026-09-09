<script lang="ts">
	import { onMount } from 'svelte';
	import { cloudProviderLabel } from '$lib/cloud-security-presenter';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>General</h2>
			<p class="muted">Rename or validate this provider credential.</p>
		</div>
		<span>{data.token.serversCount} server{data.token.serversCount === 1 ? '' : 's'}</span>
	</div>
	<form method="POST" action="?/update">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					required
					value={data.token.name}
					disabled={!ready}
				/></label
			>
			<label>Provider<input value={cloudProviderLabel(data.token.provider)} disabled /></label>
		</div>
		<p class="muted">
			The public Coolify API does not support token rotation. Create a new token to replace this
			credential.
		</p>
		<button class="primary" disabled={!ready}>Save token name</button>
	</form>
	<form method="POST" action="?/validate" class="actions">
		<button disabled={!ready}>Validate credential</button>
		<span class="muted"
			>Coolify checks the stored credential with {cloudProviderLabel(data.token.provider)}.</span
		>
	</form>
</section>
