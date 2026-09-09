<script lang="ts">
	import { onMount } from 'svelte';
	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const rows = $derived(form?.rows ?? data.rows);
</script>

<svelte:head><title>Service domains - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Domains</h2>
	<p class="muted">
		Assign public URLs to each Compose application. Separate URLs with commas; leave empty to remove
		them.
	</p>
	{#if rows.length}
		<form method="POST" action="?/saveDomains">
			{#each rows as row, index (row.name)}
				<input type="hidden" name="name" value={row.name} />
				<label>{row.label} URLs <input name="url" value={row.url} disabled={!ready} /></label>
				{#if form?.rowErrors?.[index]}<p class="error">{form.rowErrors[index]}</p>{/if}
			{/each}
			<button class="primary" type="submit" disabled={!ready}>Save domains</button>
			{#if form?.conflict}
				<p class="error">
					These domains conflict with another resource. Overriding may interrupt its routing.
				</p>
				{#each form.conflicts ?? [] as conflict, index (index)}<p>
						{conflict.domain}: {conflict.resourceName}
					</p>{/each}
				<button class="danger" name="confirmation" value="override domains" disabled={!ready}
					>Confirm domain override</button
				>
			{/if}
		</form>
	{:else}<p class="muted">No application containers available for domains.</p>{/if}
</section>
