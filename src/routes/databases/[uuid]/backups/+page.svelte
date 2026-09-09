<script lang="ts">
	import { resolve } from '$app/paths';
	import DatabaseBackupForm from '$lib/components/DatabaseBackupForm.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Database backups - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Database backups</h2>
	<p class="muted">
		Native database dumps. Backups of mounted files are managed in <a
			href={resolve('/databases/[uuid]/persistent-storage', { uuid: data.uuid })}
			>Persistent storage</a
		>.
	</p>
	{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{:else}
		{#if data.schedules.length}<div class="table-wrap">
				<table>
					<thead><tr><th>Schedule</th><th>State</th><th>Destination</th><th>Actions</th></tr></thead
					><tbody
						>{#each data.schedules as schedule (schedule.uuid)}<tr
								><td>{schedule.frequency}</td><td>{schedule.enabled ? 'Enabled' : 'Disabled'}</td
								><td>{schedule.saveS3 ? 'Local + S3' : 'Local'}</td><td
									><a
										href={resolve('/databases/[uuid]/backups/[backup]', {
											uuid: data.uuid,
											backup: schedule.uuid
										})}>Configure and view executions</a
									></td
								></tr
							>{/each}</tbody
					>
				</table>
			</div>{:else}<p class="muted">No native backup schedules.</p>{/if}
		{#if data.s3RequestError}<p class="error">{data.s3RequestError}</p>{/if}
		<details>
			<summary>Add backup schedule</summary>{#key data.uuid}<DatabaseBackupForm
					create
					{form}
					s3Storages={data.s3Storages}
					retentionFields={data.retentionFields}
					engine={data.overview?.engine ?? 'unknown'}
				/>{/key}
		</details>
	{/if}
</section>
