<script lang="ts">
	import StorageTable from '$lib/components/StorageTable.svelte';
	import { asRecord, firstText } from '$lib/resource-presenter';
	import type {
		ApplicationStorageSummary,
		S3StorageOption
	} from '$lib/server/application-storage-actions';

	interface StorageActionResult {
		error?: string;
		message?: string;
		target?: string;
		operation?: string;
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean | number>;
		backupSchedule?: Record<string, unknown>;
	}

	interface StoragePageData {
		applicationName: string;
		application: unknown;
		storages: ApplicationStorageSummary[];
		s3Storages: S3StorageOption[];
		requestError?: string;
		s3RequestError?: string;
	}

	let { data, form }: { data: StoragePageData; form: StorageActionResult | null } = $props();
	const applicationReadOnly = $derived(
		firstText(asRecord(data.application), ['build_pack']).toLowerCase() === 'dockercompose'
	);
</script>

<svelte:head><title>Persistent storage - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Persistent storage</h2>
			<p class="muted">
				Manage persistent volumes, managed files, directories, host files, and eligible volume
				backups.
			</p>
		</div>
	</div>

	{#if applicationReadOnly}
		<p class="muted">
			This application uses Docker Compose. Its declared storage is read-only here; edit the Compose
			definition to change it.
		</p>
	{/if}
	{#if data.s3RequestError}
		<p class="muted">
			S3 destinations could not be loaded. Local backup schedules remain available.
		</p>
	{/if}

	<StorageTable
		storages={data.storages}
		s3Storages={data.s3Storages}
		{applicationReadOnly}
		{form}
	/>

	{#if !applicationReadOnly}
		<details>
			<summary>Add storage</summary>
			<form method="POST" action="?/createStorage">
				<label>
					Storage type
					<select name="kind">
						<option value="persistent">Persistent volume</option>
						<option value="file">Managed file</option>
						<option value="directory">Directory mount</option>
						<option value="host-file">Host file mount</option>
					</select>
				</label>
				{#if form?.target === 'create' && form.fieldErrors?.kind}
					<p class="error">{form.fieldErrors.kind}</p>
				{/if}

				<label>
					Volume name <span class="muted">(persistent volumes only)</span>
					<input name="name" />
				</label>
				{#if form?.target === 'create' && form.fieldErrors?.name}
					<p class="error">{form.fieldErrors.name}</p>
				{/if}

				<label>
					Destination path inside the container
					<input name="mount_path" placeholder="/data" required />
				</label>
				{#if form?.target === 'create' && form.fieldErrors?.mount_path}
					<p class="error">{form.fieldErrors.mount_path}</p>
				{/if}

				<label>
					Host path <span class="muted">(optional; persistent volumes only)</span>
					<input name="host_path" placeholder="/srv/data" />
				</label>
				{#if form?.target === 'create' && form.fieldErrors?.host_path}
					<p class="error">{form.fieldErrors.host_path}</p>
				{/if}
				<label>
					Source path on the server <span class="muted">(directory and host-file mounts)</span>
					<input name="fs_path" placeholder="/srv/data" />
				</label>
				{#if form?.target === 'create' && form.fieldErrors?.fs_path}
					<p class="error">{form.fieldErrors.fs_path}</p>
				{/if}
				<label>
					Managed file content <span class="muted">(managed files only)</span>
					<textarea name="content"></textarea>
				</label>
				<p class="muted">
					Only fields for the selected type are sent to Coolify. Managed file content is write-only
					in Warmify and is never returned in form errors or SSR.
				</p>

				<button class="primary" type="submit">Add storage</button>
			</form>
		</details>
	{/if}
</section>
