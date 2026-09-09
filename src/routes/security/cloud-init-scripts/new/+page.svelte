<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	let { form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string>);
</script>

<svelte:head><title>New cloud-init script - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New cloud-init script</h1>
		<p class="muted">Create reusable server initialization content.</p>
	</div>
	<a href={resolve('/security/cloud-init-scripts')}>All scripts</a>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
<section class="settings-section">
	<h2>Script</h2>
	<form method="POST" action="?/create">
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
			>Script content<textarea
				name="script"
				rows="16"
				required
				placeholder="#cloud-config or #!/bin/sh"
				disabled={!ready}></textarea></label
		>
		<p class="muted">
			Coolify accepts valid cloud-config YAML or shell scripts beginning with a shebang. Content is
			write-only in Warmify.
		</p>
		<button class="primary" disabled={!ready}>Create script</button>
	</form>
</section>
