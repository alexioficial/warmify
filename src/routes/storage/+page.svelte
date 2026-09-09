<script lang="ts">
	import { resolve } from '$app/paths';
	import { s3StorageCollection, type S3StorageView } from '$lib/s3-storage-presenter';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';

	let { data } = $props();
	let query = $state('');
	let refreshed = $state<S3StorageView[]>();
	const storages = $derived(refreshed ?? data.storages);
	const filtered = $derived(
		storages.filter((storage) => {
			const needle = query.trim().toLowerCase();
			return (
				!needle ||
				[storage.name, storage.endpoint, storage.bucket, storage.region]
					.join(' ')
					.toLowerCase()
					.includes(needle)
			);
		})
	);
</script>

<svelte:head><title>S3 storage - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>S3 storage</h1>
		<p class="muted">S3-compatible destinations used by backup schedules.</p>
	</div>
	<a class="button primary" href={resolve('/storage/new')}>New S3 storage</a>
</div>
<CollectionSynchronizer
	url="/internal/poll/collections/storage"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = s3StorageCollection(value))}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<div class="page-toolbar">
	<label class="visually-hidden" for="storage-search">Search S3 storage</label>
	<input id="storage-search" type="search" placeholder="Search S3 storage" bind:value={query} />
</div>
{#if filtered.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead
				><tr><th>Name</th><th>Status</th><th>Bucket</th><th>Region</th><th>Endpoint</th></tr></thead
			>
			<tbody>
				{#each filtered as storage (storage.uuid)}
					<tr>
						<td><a href={resolve(`/storage/${storage.uuid}/general` as '/')}>{storage.name}</a></td>
						<td
							><span
								class:status-running={storage.isUsable}
								class:status-failed={!storage.isUsable}
								class="status">{storage.isUsable ? 'Usable' : 'Needs validation'}</span
							></td
						>
						<td>{storage.bucket || '—'}</td><td>{storage.region || '—'}</td><td
							>{storage.endpoint || '—'}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if query}<p>No storage matches your search.</p>{:else}<p>
		No S3 storage configured yet.
	</p>{/if}
