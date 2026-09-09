<script lang="ts">
	let {
		updatedAt,
		syncing = false,
		stale = false,
		error = ''
	}: { updatedAt?: number; syncing?: boolean; stale?: boolean; error?: string } = $props();

	const dateTime = $derived(
		updatedAt && Number.isFinite(updatedAt) ? new Date(updatedAt).toISOString() : ''
	);
	const label = $derived(dateTime ? dateTime.replace('T', ' ').replace('.000Z', ' UTC') : '');
</script>

{#if syncing || updatedAt || error}
	<p class="cache-sync-status muted" role={error ? 'status' : undefined}>
		{#if syncing}Synchronizing…{:else if updatedAt}
			Last synchronized <time datetime={dateTime}>{label}</time>
		{/if}
		{#if error}
			<span class="cache-sync-warning">Cached data is shown; live synchronization failed.</span>
		{:else if stale && !syncing}
			<span class="cache-sync-warning">Cached data may be stale.</span>
		{/if}
	</p>
{/if}
