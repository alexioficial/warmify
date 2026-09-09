<script lang="ts">
	import StorageActions from '$lib/components/StorageActions.svelte';
	import type {
		ApplicationStorageSummary,
		S3StorageOption
	} from '$lib/server/application-storage-actions';

	interface StorageActionResult {
		target?: string;
		operation?: string;
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean | number>;
		backupSchedule?: Record<string, unknown>;
	}

	let {
		storages,
		s3Storages = [],
		applicationReadOnly = false,
		form = null
	}: {
		storages: ApplicationStorageSummary[];
		s3Storages?: S3StorageOption[];
		applicationReadOnly?: boolean;
		form?: StorageActionResult | null;
	} = $props();

	function backupLabel(storage: ApplicationStorageSummary): string {
		if (!storage.backupEligible) return 'Not available';
		if (storage.backupState === 'enabled') return 'Enabled';
		if (storage.backupState === 'disabled') return 'Disabled';
		return 'Available; state not exposed';
	}
</script>

{#if storages.length}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Storage</th>
					<th>Type</th>
					<th>Mount path</th>
					<th>Source</th>
					<th>Backup</th>
					<th>Preview suffix</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each storages as row (row.id)}
					{@const storage = { ...row, readOnly: row.readOnly || applicationReadOnly }}
					<tr>
						<td>
							<strong>{storage.name}</strong>
							{#if storage.readOnly}<small class="variable-comment">Compose-managed</small>{/if}
						</td>
						<td>{storage.label}</td>
						<td><code>{storage.mountPath || '-'}</code></td>
						<td><code>{storage.source || '-'}</code></td>
						<td>{backupLabel(storage)}</td>
						<td>{storage.previewSuffixEnabled ? 'Enabled' : 'Disabled'}</td>
						<td>
							{#key `${storage.id}:${storage.name}:${storage.mountPath}:${storage.hostPath}:${storage.previewSuffixEnabled}:${storage.readOnly}`}
								<StorageActions {storage} {s3Storages} {form} />
							{/key}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No storage configured for this application.</p>
{/if}
