<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import PrivateKeyReveal from '$lib/components/PrivateKeyReveal.svelte';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>{data.key.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.key.name}</h1>
		<p class="muted">SSH private key</p>
	</div>
	<a href={resolve('/security/keys')}>All private keys</a>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}
<section class="settings-section">
	<h2>General</h2>
	<form method="POST" action="?/update">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					required
					value={values.name ?? data.key.name}
					disabled={!ready}
				/></label
			>
			<label
				>Description<input
					name="description"
					maxlength="255"
					value={values.description ?? data.key.description}
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Replacement private key<textarea
					name="replacement_private_key"
					rows="12"
					placeholder="Leave blank to keep the existing key"
					autocomplete="off"
					disabled={!ready}></textarea></label
			>
		</div>
		<p class="muted">
			Coolify requires key material on every update. Leaving replacement blank keeps the stored key
			only when the API token can read sensitive fields. Rotating a key may interrupt every attached
			server or Git integration until access is synchronized.
		</p>
		<button class="primary" disabled={!ready}>Save private key</button>
	</form>
</section>
<section class="settings-section">
	<h2>Key material</h2>
	<dl class="detail-list">
		<div>
			<dt>Fingerprint</dt>
			<dd><code>{data.key.fingerprint || 'Unavailable'}</code></dd>
		</div>
		<div>
			<dt>Public key</dt>
			<dd><code>{data.key.publicKey || 'Unavailable'}</code></dd>
		</div>
		<div>
			<dt>Git-related</dt>
			<dd>{data.key.isGitRelated ? 'Yes' : 'No'}</dd>
		</div>
	</dl>
	<PrivateKeyReveal url={`/security/keys/${encodeURIComponent(data.uuid)}/reveal`} />
</section>
<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p class="muted">
		Coolify refuses deletion while this key is attached to a server, application, or Git
		integration.
	</p>
	<form method="POST" action="?/delete">
		<label
			>Type {data.key.name} or {data.key.uuid} to confirm<input
				name="confirmation"
				required
				autocomplete="off"
				disabled={!ready}
			/></label
		>
		<button class="danger" disabled={!ready}>Delete private key</button>
	</form>
</section>
