<script lang="ts">
	import { resolve } from '$app/paths';
	import DatabaseBackupForm from '$lib/components/DatabaseBackupForm.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Backup schedule - Warmify</title></svelte:head>
<a href={resolve('/databases/[uuid]/backups', { uuid: data.uuid })}>All backup schedules</a>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if data.selected}
	<section class="settings-section">
		<h2>Backup schedule</h2>
		<p><code>{data.selected.uuid}</code></p>
		{#if data.s3RequestError}<p class="error">{data.s3RequestError}</p>{/if}
		{#key `${data.uuid}:${data.selected.uuid}`}<DatabaseBackupForm
				initial={data.selected.values}
				{form}
				s3Storages={data.s3Storages}
				retentionFields={data.retentionFields}
				engine={data.overview?.engine ?? 'unknown'}
			/>{/key}
	</section>
	<section class="settings-section">
		<h2>Back up now</h2>
		<p class="muted">Queues one backup using the saved schedule settings.</p>
		<form method="POST" action="?/run">
			<label
				>Type run {data.selected.uuid}
				<input name="confirmation" required autocomplete="off" /></label
			><button>Queue database backup</button>
		</form>
	</section>
	<section class="settings-section">
		<div class="section-heading">
			<h2>Executions</h2>
			<a
				href={resolve('/databases/[uuid]/backups/[backup]', {
					uuid: data.uuid,
					backup: data.selected.uuid
				})}
				data-sveltekit-reload>Refresh history</a
			>
		</div>
		{#if data.executionError}<p class="error" role="alert">
				{data.executionError}
			</p>{:else if !data.executions.length}<p class="muted">No backup executions.</p>{:else}
			<div class="table-wrap">
				<table>
					<thead
						><tr
							><th>Status</th><th>Archive</th><th>Size (bytes)</th><th>Created</th><th>Actions</th
							></tr
						></thead
					><tbody
						>{#each data.executions as execution (execution.uuid)}<tr
								><td>{execution.status}</td><td
									><code>{execution.filename || '-'}</code>{#if execution.message}<details>
											<summary>Output</summary>
											<pre class="log-output">{execution.message}</pre>
										</details>{/if}</td
								><td>{execution.size || '-'}</td><td>{execution.createdAt || '-'}</td><td
									><details>
										<summary>Delete execution</summary>
										<p>This permanently deletes the local archive and its execution record.</p>
										<form method="POST" action="?/deleteExecution">
											<input type="hidden" name="execution_uuid" value={execution.uuid} /><label
												class="checkbox-field"
												><input name="delete_s3" type="checkbox" value="true" /> Also delete this archive
												from S3</label
											><label
												>Type {execution.uuid}
												<input name="confirmation" required autocomplete="off" /></label
											><button class="danger">Delete backup execution</button>
										</form>
									</details></td
								></tr
							>{/each}</tbody
					>
				</table>
			</div>
		{/if}
		<p class="muted">
			Archive downloading, restore/import and bulk cleanup are not available through this public
			API. The history endpoint does not report local/S3 availability; no availability is inferred
			from success alone.
		</p>
	</section>
	<section class="settings-section">
		<h2>Delete schedule</h2>
		<p>
			This permanently deletes this schedule, all its execution records and their local archives. S3
			copies are deleted only when explicitly selected.
		</p>
		<form method="POST" action="?/deleteSchedule">
			<label class="checkbox-field"
				><input type="checkbox" name="delete_s3" value="true" /> Also delete all associated S3 archives</label
			><label
				>Type {data.selected.uuid} <input name="confirmation" required autocomplete="off" /></label
			><button class="danger">Delete schedule and local archives</button>
		</form>
	</section>
{/if}
