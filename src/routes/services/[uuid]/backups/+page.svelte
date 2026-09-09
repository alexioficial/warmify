<script lang="ts">
	import StorageTable from '$lib/components/StorageTable.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Service volume backups - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<h2>Volume backups</h2>
	<p class="muted">
		Configure, run, or remove backups for eligible persistent volumes and directory mounts.
	</p>
	<p class="muted">
		Coolify's public API does not expose backup schedule history unless it is included in the
		storage response.
	</p>
	<StorageTable
		storages={data.storages}
		s3Storages={data.s3Storages}
		applicationReadOnly={false}
		{form}
	/>
</section>
