<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>New cloud token - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New cloud token</h1>
		<p class="muted">Validate and save a provider credential.</p>
	</div>
	<a href={resolve('/security/cloud-tokens')}>All cloud tokens</a>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
<section class="settings-section">
	<h2>Provider credential</h2>
	<form method="POST" action="?/create">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					required
					value={values.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Provider<select
					name="provider"
					required
					value={values.provider ?? 'hetzner'}
					disabled={!ready}
				>
					<option value="hetzner">Hetzner</option>
					<option value="digitalocean">DigitalOcean</option>
					<option value="vultr">Vultr</option>
				</select></label
			>
			<label class="wide"
				>API token<input
					name="token"
					type="password"
					required
					autocomplete="new-password"
					disabled={!ready}
				/></label
			>
		</div>
		<p class="muted">
			Coolify validates the credential before saving it. Warmify never stores it in SQLite or
			returns it to the browser.
		</p>
		<button class="primary" disabled={!ready}>Validate and create token</button>
	</form>
</section>
