<script lang="ts">
	import StorageTable from '$lib/components/StorageTable.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Database persistent storage - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Persistent storage</h2>
	{#if data.requestError}<p role="alert" class="error">{data.requestError}</p>{/if}
	{#if data.s3RequestError}<p class="muted">
			S3 destinations could not be loaded. Local volume backups remain available.
		</p>{/if}
	<p class="muted">
		Volume backups copy storage files. They are separate from engine-native database dumps.
	</p>
	{#key data.uuid}<StorageTable
			storages={data.storages}
			s3Storages={data.s3Storages}
			applicationReadOnly={false}
			{form}
		/>{/key}
	<details>
		<summary>Add storage</summary>
		<form method="POST" action="?/createStorage">
			<label
				>Storage type <select name="kind"
					><option value="persistent">Persistent volume</option><option value="file"
						>Managed file</option
					><option value="directory">Directory mount</option><option value="host-file"
						>Host file mount</option
					></select
				></label
			>
			<label>Volume name (persistent only) <input name="name" /></label>
			<label>Container path <input name="mount_path" required placeholder="/data" /></label>
			<label>Host path (optional) <input name="host_path" /></label>
			<label>Source path (directory or host file) <input name="fs_path" /></label>
			<label>Managed file content <textarea name="content"></textarea></label>
			<p class="muted">
				File content is write-only and is never returned in HTML or validation errors.
			</p>
			{#if form?.target === 'create'}{#each Object.entries(form.fieldErrors ?? {}) as [name, message] (name)}<p
						class="error"
					>
						{name}: {message}
					</p>{/each}{/if}
			<button class="primary">Add storage</button>
		</form>
	</details>
</section>
