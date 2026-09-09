<script lang="ts">
	import StorageTable from '$lib/components/StorageTable.svelte';
	import { asRecord, firstText, normalizeRecords } from '$lib/resource-presenter';
	let { data, form } = $props();
	const containers = $derived([
		...normalizeRecords(asRecord(data.service)?.applications),
		...normalizeRecords(asRecord(data.service)?.databases)
	]);
</script>

<svelte:head><title>Service persistent storage - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<h2>Persistent storage</h2>
	<p class="muted">Manage service volumes, files, mounts, and eligible backup schedules.</p>
	{#if data.s3RequestError}<p class="muted">
			S3 destinations could not be loaded; local backup schedules remain available.
		</p>{/if}
	<StorageTable
		storages={data.storages}
		s3Storages={data.s3Storages}
		applicationReadOnly={false}
		{form}
	/>
	<details>
		<summary>Add storage</summary>
		<form method="POST" action="?/createStorage">
			<label
				>Container <select name="resource_uuid" required
					><option value="">Choose a container</option
					>{#each containers as container (firstText(container, ['uuid']))}<option
							value={firstText(container, ['uuid'])}
							>{firstText(container, ['human_name', 'name'])}</option
						>{/each}</select
				></label
			>
			<label
				>Storage type
				<select name="kind"
					><option value="persistent">Persistent volume</option><option value="file"
						>Managed file</option
					><option value="directory">Directory mount</option><option value="host-file"
						>Host file mount</option
					></select
				>
			</label>
			<label>Volume name <span class="muted">(persistent only)</span><input name="name" /></label>
			<label
				>Destination path inside the container <input
					name="mount_path"
					placeholder="/data"
					required
				/></label
			>
			<label
				>Host path <span class="muted">(optional)</span><input
					name="host_path"
					placeholder="/srv/data"
				/></label
			>
			<label
				>Source path on the server <span class="muted">(directory or host-file)</span><input
					name="fs_path"
					placeholder="/srv/data"
				/></label
			>
			<label
				>Managed file content <span class="muted">(managed file only)</span><textarea name="content"
				></textarea></label
			>
			<p class="muted">
				Managed file content is write-only and never returned in SSR or form errors.
			</p>
			<button class="primary" type="submit">Add storage</button>
		</form>
	</details>
</section>
