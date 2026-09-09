<script lang="ts">
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
		storage,
		s3Storages = [],
		form = null
	}: {
		storage: ApplicationStorageSummary;
		s3Storages?: S3StorageOption[];
		form?: StorageActionResult | null;
	} = $props();

	function initialValues(operation: string) {
		return form?.target === storage.id && form.operation === operation ? (form.values ?? {}) : {};
	}

	function initialSchedule() {
		return form?.target === storage.id && form.operation === 'backup-schedule'
			? (form.backupSchedule ?? {})
			: {};
	}

	const editValues = initialValues('update');
	const backupValues = initialValues('backup-schedule');
	const backupSchedule = initialSchedule();
	function editValue(name: string, fallback: string | boolean) {
		return editValues[name] ?? fallback;
	}
	function initialEditState() {
		return {
			name: String(editValue('name', storage.name)),
			mountPath: String(editValue('mountPath', storage.mountPath)),
			hostPath: String(editValue('hostPath', storage.hostPath)),
			previewSuffixEnabled:
				editValue('previewSuffixEnabled', storage.previewSuffixEnabled) === true,
			replaceContent: editValue('replaceContent', false) === true
		};
	}
	const initialEdit = initialEditState();

	let name = $state(initialEdit.name);
	let mountPath = $state(initialEdit.mountPath);
	let hostPath = $state(initialEdit.hostPath);
	let previewSuffixEnabled = $state(initialEdit.previewSuffixEnabled);
	let replaceContent = $state(initialEdit.replaceContent);

	function backupValue(camel: string, snake: string, fallback: string | number | boolean) {
		if (backupValues[camel] !== undefined) return backupValues[camel];
		if (backupSchedule[snake] !== undefined)
			return backupSchedule[snake] as string | number | boolean;
		return fallback;
	}

	let frequency = $state(String(backupValue('frequency', 'frequency', '0 2 * * *')));
	let enabled = $state(backupValue('enabled', 'enabled', true) === true);
	let saveS3 = $state(backupValue('saveS3', 'save_s3', false) === true);
	let disableLocalBackup = $state(
		backupValue('disableLocalBackup', 'disable_local_backup', false) === true
	);
	let stopDuringBackup = $state(
		backupValue('stopDuringBackup', 'stop_during_backup', false) === true
	);
	let s3StorageUuid = $state(String(backupValue('s3StorageUuid', 's3_storage_uuid', '')));
	let retentionAmountLocally = $state(
		Number(backupValue('retentionAmountLocally', 'retention_amount_locally', 7))
	);
	let retentionDaysLocally = $state(
		Number(backupValue('retentionDaysLocally', 'retention_days_locally', 0))
	);
	let retentionMaxStorageLocally = $state(
		Number(backupValue('retentionMaxStorageLocally', 'retention_max_storage_locally', 0))
	);
	let retentionAmountS3 = $state(
		Number(backupValue('retentionAmountS3', 'retention_amount_s3', 7))
	);
	let retentionDaysS3 = $state(Number(backupValue('retentionDaysS3', 'retention_days_s3', 0)));
	let retentionMaxStorageS3 = $state(
		Number(backupValue('retentionMaxStorageS3', 'retention_max_storage_s3', 0))
	);
	let timeout = $state(Number(backupValue('timeout', 'timeout', 36000)));
</script>

<div class="actions storage-actions">
	<details>
		<summary>Edit</summary>
		<form method="POST" action="?/updateStorage">
			<input type="hidden" name="storage_uuid" value={storage.id} />
			<input type="hidden" name="storage_type" value={storage.type} />
			<input type="hidden" name="kind" value={storage.kind} />
			<input type="hidden" name="read_only" value={String(storage.readOnly)} />
			<p><strong>{storage.name}</strong></p>
			{#if storage.readOnly}
				<p class="muted">
					This storage is managed by Docker Compose. Coolify only allows changing its preview suffix
					setting here.
				</p>
			{:else if storage.type === 'persistent'}
				<label>
					Volume name
					<input
						name="name"
						bind:value={name}
						required
						aria-invalid={form?.target === storage.id && form.fieldErrors?.name
							? 'true'
							: undefined}
					/>
				</label>
				{#if form?.target === storage.id && form.fieldErrors?.name}
					<p class="error">{form.fieldErrors.name}</p>
				{/if}
				<label>
					Mount path
					<input name="mount_path" bind:value={mountPath} required />
				</label>
				<label>
					Host path <span class="muted">(optional)</span>
					<input name="host_path" bind:value={hostPath} />
				</label>
			{:else}
				<label>
					Mount path
					<input name="mount_path" bind:value={mountPath} required />
				</label>
				{#if storage.kind === 'file'}
					<label class="checkbox-field">
						<input type="hidden" name="replace_content" value="false" />
						<input
							type="checkbox"
							name="replace_content"
							value="true"
							bind:checked={replaceContent}
						/>
						Replace managed file content
					</label>
					<label>
						Replacement content
						<textarea name="content"></textarea>
					</label>
					<p class="muted">
						This field is ignored until “Replace managed file content” is checked. Existing and
						submitted content is never returned to the page.
					</p>
				{:else}
					<p class="muted">
						Source path: <code>{storage.fsPath}</code>. Coolify's public API does not allow changing
						a directory or host-file source after creation.
					</p>
				{/if}
			{/if}
			<label class="checkbox-field">
				<input type="hidden" name="is_preview_suffix_enabled" value="false" />
				<input
					type="checkbox"
					name="is_preview_suffix_enabled"
					value="true"
					bind:checked={previewSuffixEnabled}
				/>
				Add a pull-request suffix for preview deployments
			</label>
			{#if form?.target === storage.id && form.operation === 'update'}
				{#each Object.entries(form.fieldErrors ?? {}) as [field, error] (field)}
					{#if field !== 'name'}<p class="error">{error}</p>{/if}
				{/each}
			{/if}
			<button class="primary" type="submit">Save storage</button>
		</form>
	</details>

	{#if storage.backupEligible}
		<details>
			<summary>Backup schedule</summary>
			<p class="muted">
				Saving replaces the schedule for this storage. Coolify's public API cannot read a schedule
				back, so values are only retained in this response.
			</p>
			<form method="POST" action="?/upsertBackup">
				<input type="hidden" name="storage_uuid" value={storage.id} />
				<div class="field-grid">
					<label>
						Frequency
						<input name="frequency" bind:value={frequency} required />
						<small>Cron or a Coolify-supported human expression.</small>
					</label>
					<label>
						Timeout in seconds
						<input name="timeout" type="number" min="60" max="36000" bind:value={timeout} />
					</label>
				</div>
				<div class="inline-list">
					<label class="checkbox-field">
						<input type="hidden" name="enabled" value="false" />
						<input type="checkbox" name="enabled" value="true" bind:checked={enabled} />
						Enabled
					</label>
					<label class="checkbox-field">
						<input type="hidden" name="stop_during_backup" value="false" />
						<input
							type="checkbox"
							name="stop_during_backup"
							value="true"
							bind:checked={stopDuringBackup}
						/>
						Stop application during backup
					</label>
					<label class="checkbox-field">
						<input type="hidden" name="save_s3" value="false" />
						<input type="checkbox" name="save_s3" value="true" bind:checked={saveS3} />
						Save to S3
					</label>
				</div>
				<label>
					S3 storage
					<select name="s3_storage_uuid" bind:value={s3StorageUuid}>
						<option value="">Choose a usable S3 storage</option>
						{#each s3Storages as s3 (s3.uuid)}
							<option value={s3.uuid}>{s3.name}</option>
						{/each}
					</select>
					<small>Used only when “Save to S3” is checked.</small>
				</label>
				<label class="checkbox-field">
					<input type="hidden" name="disable_local_backup" value="false" />
					<input
						type="checkbox"
						name="disable_local_backup"
						value="true"
						bind:checked={disableLocalBackup}
					/>
					Keep only the S3 copy
				</label>
				<h3>Retention</h3>
				<div class="field-grid storage-retention-grid">
					<label
						>Local copies<input
							name="retention_amount_locally"
							type="number"
							min="0"
							max="10000"
							bind:value={retentionAmountLocally}
						/></label
					>
					<label
						>Local days<input
							name="retention_days_locally"
							type="number"
							min="0"
							bind:value={retentionDaysLocally}
						/></label
					>
					<label
						>Local maximum storage<input
							name="retention_max_storage_locally"
							type="number"
							min="0"
							step="any"
							bind:value={retentionMaxStorageLocally}
						/></label
					>
					<label
						>S3 copies<input
							name="retention_amount_s3"
							type="number"
							min="0"
							max="10000"
							bind:value={retentionAmountS3}
						/></label
					>
					<label
						>S3 days<input
							name="retention_days_s3"
							type="number"
							min="0"
							bind:value={retentionDaysS3}
						/></label
					>
					<label
						>S3 maximum storage<input
							name="retention_max_storage_s3"
							type="number"
							min="0"
							step="any"
							bind:value={retentionMaxStorageS3}
						/></label
					>
				</div>
				{#if form?.target === storage.id && form.operation === 'backup-schedule'}
					{#each Object.entries(form.fieldErrors ?? {}) as [field, error] (field)}
						<p class="error"><strong>{field}:</strong> {error}</p>
					{/each}
				{/if}
				<button class="primary" type="submit">Save backup schedule</button>
			</form>
		</details>

		<details>
			<summary>Back up now</summary>
			<form method="POST" action="?/runBackup">
				<input type="hidden" name="storage_uuid" value={storage.id} />
				<label>
					Type <code>run backup</code> to confirm
					<input name="confirmation" autocomplete="off" required />
				</label>
				<button type="submit">Queue backup</button>
			</form>
		</details>

		<details>
			<summary>Delete backup schedule</summary>
			<form method="POST" action="?/deleteBackup">
				<input type="hidden" name="storage_uuid" value={storage.id} />
				<p class="muted">This permanently deletes the schedule and its local and S3 archives.</p>
				<label>
					Type <code>{storage.name}</code> to confirm
					<input name="confirmation" autocomplete="off" required />
				</label>
				<button class="danger" type="submit">Delete schedule and archives</button>
			</form>
		</details>
	{/if}

	{#if !storage.readOnly}
		<details>
			<summary>Delete storage</summary>
			<form method="POST" action="?/deleteStorage">
				<input type="hidden" name="storage_uuid" value={storage.id} />
				<p class="muted">Delete any backup schedule and archives before deleting this storage.</p>
				<label>
					Type <code>{storage.name}</code> to confirm
					<input name="confirmation" autocomplete="off" required />
				</label>
				<button class="danger" type="submit">Delete storage</button>
			</form>
		</details>
	{/if}
</div>
