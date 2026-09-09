<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>New S3 storage - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New S3 storage</h1>
		<p class="muted">Add an S3-compatible backup destination.</p>
	</div>
	<a href={resolve('/storage')}>All S3 storage</a>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
<section class="settings-section">
	<h2>Connection</h2>
	<form method="POST" action="?/create">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					minlength="3"
					maxlength="255"
					required
					value={values.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Region<input
					name="region"
					maxlength="255"
					required
					value={values.region ?? 'us-east-1'}
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Endpoint<input
					name="endpoint"
					type="url"
					maxlength="255"
					required
					placeholder="https://s3.us-east-1.amazonaws.com"
					value={values.endpoint ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Bucket<input
					name="bucket"
					minlength="3"
					maxlength="63"
					required
					value={values.bucket ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Access key<input
					name="key"
					type="password"
					maxlength="255"
					required
					autocomplete="new-password"
					disabled={!ready}
				/></label
			>
			<label
				>Secret key<input
					name="secret"
					type="password"
					maxlength="255"
					required
					autocomplete="new-password"
					disabled={!ready}
				/></label
			>
			<label class="wide"
				>Description<input
					name="description"
					maxlength="255"
					value={values.description ?? ''}
					disabled={!ready}
				/></label
			>
		</div>
		<p class="muted">
			Credentials are sent once to Coolify and are never stored in Warmify's cache.
		</p>
		<button class="primary" disabled={!ready}>Create storage</button>
	</form>
</section>
