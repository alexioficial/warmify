<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>New private key - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New private key</h1>
		<p class="muted">Add an SSH private key already managed by your team.</p>
	</div>
	<a href={resolve('/security/keys')}>All private keys</a>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
<section class="settings-section">
	<h2>Key details</h2>
	<form method="POST" action="?/create">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					value={values.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Description<input
					name="description"
					maxlength="255"
					value={values.description ?? ''}
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Private key<textarea
					name="private_key"
					rows="14"
					required
					autocomplete="off"
					disabled={!ready}></textarea></label
			>
		</div>
		<p class="muted">
			Key material is sent once to Coolify. Warmify does not preserve it in failed form data, SSR,
			audit records, or SQLite.
		</p>
		<button class="primary" disabled={!ready}>Create private key</button>
	</form>
</section>
