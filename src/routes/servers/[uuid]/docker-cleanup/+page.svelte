<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<h2>Docker cleanup</h2>
<p class="muted">Schedule image cleanup and review the latest 20 cleanup executions.</p>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<form method="POST" action="?/update" use:enhance>
	<fieldset disabled={!ready}>
		<legend>Schedule</legend>
		<div class="form-grid">
			<label
				>Cleanup frequency<input
					name="docker_cleanup_frequency"
					value={data.settings.frequency}
					maxlength="255"
					required
				/></label
			>
			<label
				>Disk threshold (%)<input
					name="docker_cleanup_threshold"
					type="number"
					min="1"
					max="99"
					value={data.settings.threshold}
					required
				/></label
			>
		</div>
	</fieldset>
	<fieldset disabled={!ready}>
		<legend>Cleanup policy</legend>
		{#each [['force_docker_cleanup', 'Force cleanup even below the disk threshold', data.settings.force], ['delete_unused_volumes', 'Delete unused Docker volumes', data.settings.deleteUnusedVolumes], ['delete_unused_networks', 'Delete unused Docker networks', data.settings.deleteUnusedNetworks], ['disable_application_image_retention', 'Disable retention of recent application images', data.settings.disableImageRetention]] as option (option[0])}
			<input type="hidden" name={String(option[0])} value="false" />
			<label class="checkbox-field">
				<input
					type="checkbox"
					name={String(option[0])}
					value="true"
					checked={Boolean(option[2])}
				/>{option[1]}
			</label>
		{/each}
	</fieldset>
	<button class="primary" disabled={!ready}>Save cleanup settings</button>
</form>

<section class="settings-section">
	<h3>Run cleanup now</h3>
	<p>This queues remote Docker pruning. It is not automatically retried.</p>
	<form method="POST" action="?/run" use:enhance>
		<input type="hidden" name="delete_unused_volumes" value="false" />
		<label class="checkbox-field">
			<input type="checkbox" name="delete_unused_volumes" value="true" disabled={!ready} /> Delete unused
			volumes in this run
		</label>
		<input type="hidden" name="delete_unused_networks" value="false" />
		<label class="checkbox-field">
			<input type="checkbox" name="delete_unused_networks" value="true" disabled={!ready} /> Delete unused
			networks in this run
		</label>
		<label
			>Type <strong>RUN CLEANUP</strong> to confirm<input
				name="confirmation"
				autocomplete="off"
				required
				disabled={!ready}
			/></label
		>
		<button class="danger" disabled={!ready}>Run Docker cleanup</button>
	</form>
</section>

<section class="settings-section">
	<h3>Recent executions</h3>
	{#if data.executions.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Status</th><th>Message</th><th>Started</th><th>Finished</th></tr></thead>
				<tbody>
					{#each data.executions as execution (execution.uuid)}
						<tr>
							<td>{execution.status}</td>
							<td>{execution.message || '—'}</td>
							<td>{execution.createdAt || '—'}</td>
							<td>{execution.finishedAt || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if !data.requestError}
		<p>No cleanup executions yet.</p>
	{/if}
</section>
