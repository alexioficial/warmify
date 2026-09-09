<script lang="ts">
	import { resolve } from '$app/paths';
	import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';

	let { data } = $props();
	const service = $derived(asRecord(data.service));
	const applications = $derived(normalizeRecords(service?.applications));
	const databases = $derived(normalizeRecords(service?.databases));
</script>

<svelte:head><title>Service resources - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Service resources</h2>
	<p class="muted">Applications and databases defined by this Compose service.</p>
	<h3>Applications</h3>
	{#if applications.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Name</th><th>Image</th><th>Status</th></tr></thead>
				<tbody>
					{#each applications as application (firstText(application, ['uuid', 'id', 'name']))}
						<tr>
							<td>
								<a
									href={resolve(
										`/services/${encodeURIComponent(data.uuid)}/applications/${encodeURIComponent(firstText(application, ['uuid', 'id']))}` as '/'
									)}>{firstText(application, ['human_name', 'name', 'uuid'])}</a
								>
							</td>
							<td>{firstText(application, ['image']) || 'Unknown'}</td>
							<td>{firstText(application, ['status']) || 'Unknown'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}<p class="muted">No application containers were returned.</p>{/if}

	<h3>Databases</h3>
	{#if databases.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Name</th><th>Image</th><th>Status</th></tr></thead>
				<tbody>
					{#each databases as database (firstText(database, ['uuid', 'id', 'name']))}
						<tr>
							<td>
								<a
									href={resolve(
										`/services/${encodeURIComponent(data.uuid)}/databases/${encodeURIComponent(firstText(database, ['uuid', 'id']))}` as '/'
									)}>{firstText(database, ['human_name', 'name', 'uuid'])}</a
								>
							</td>
							<td>{firstText(database, ['image']) || 'Unknown'}</td>
							<td>{firstText(database, ['status']) || 'Unknown'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}<p class="muted">No database containers were returned.</p>{/if}
</section>
