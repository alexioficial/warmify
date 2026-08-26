<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Sign in — Warmify</title></svelte:head>

<h1>Warmify</h1>
<p>Sign in to administer the configured Coolify instance.</p>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
<form method="POST">
	<input type="hidden" name="returnTo" value={data.returnTo} />
	<label
		>Username <input
			name="username"
			autocomplete="username"
			value={form?.username ?? ''}
			required
		/></label
	>
	<label
		>Password <input
			name="password"
			type="password"
			autocomplete="current-password"
			required
		/></label
	>
	<button type="submit">Sign in</button>
</form>
