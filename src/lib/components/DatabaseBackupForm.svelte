<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { BackupActionResult, BackupValues } from '$lib/server/database-backup-presenter';
	let {
		initial = {},
		form = null,
		create = false,
		s3Storages,
		retentionFields,
		engine
	}: {
		initial?: BackupValues;
		form?: BackupActionResult | null;
		create?: boolean;
		s3Storages: Array<{ uuid: string; name: string }>;
		retentionFields: Array<{ name: string; label: string; decimal: boolean }>;
		engine: string;
	} = $props();
	let values = $state<BackupValues & { enabled: boolean; save_s3: boolean; dump_all: boolean }>(
		untrack(() => {
			const drafts: BackupValues = {
				frequency: create ? 'daily' : '',
				enabled: create,
				save_s3: false,
				dump_all: false,
				...initial,
				...form?.values
			};
			return {
				...drafts,
				enabled: drafts.enabled === true,
				save_s3: drafts.save_s3 === true,
				dump_all: drafts.dump_all === true
			};
		})
	);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const errors = $derived(form?.fieldErrors ?? {});
</script>

<form method="POST" action={create ? '?/create' : '?/update'}>
	<div class="field-grid">
		<label
			>Frequency <input
				name="frequency"
				bind:value={values.frequency}
				required
				disabled={!ready}
				aria-invalid={errors.frequency ? 'true' : undefined}
			/></label
		>
		<label
			>Timeout (seconds) <input
				name="timeout"
				type="number"
				min="60"
				max="36000"
				value={values.timeout ?? ''}
				disabled={!ready}
				placeholder="Keep Coolify default"
			/></label
		>
		<label class="wide"
			>Databases to back up <input
				name="databases_to_backup"
				bind:value={values.databases_to_backup}
				disabled={!ready}
			/></label
		>
	</div>
	<p class="muted">
		Use every_minute, hourly, daily, weekly, monthly, yearly or a cron expression. Runs use
		Coolify's deployment-server timezone.
	</p>
	<p class="muted">
		{engine === 'mongodb'
			? 'Leave database selection empty for all databases and collections. Coolify also accepts database:collection1,collection2|database2 to exclude collections.'
			: 'Use comma-separated database names. Leave empty for the default database.'}
	</p>
	<label class="checkbox-field"
		><input type="hidden" name="enabled" value="false" /><input
			type="checkbox"
			name="enabled"
			value="true"
			bind:checked={values.enabled}
			disabled={!ready}
		/> Enable schedule</label
	>
	{#if ['postgresql', 'mysql', 'mariadb'].includes(engine)}<label class="checkbox-field"
			><input type="hidden" name="dump_all" value="false" /><input
				type="checkbox"
				name="dump_all"
				value="true"
				bind:checked={values.dump_all}
				disabled={!ready}
			/> Dump all databases</label
		>{/if}
	<h3>S3 storage</h3>
	<label class="checkbox-field"
		><input type="hidden" name="save_s3" value="false" /><input
			type="checkbox"
			name="save_s3"
			value="true"
			bind:checked={values.save_s3}
			disabled={!ready}
		/> Copy backups to S3</label
	>
	<label
		>S3 destination <select
			name="s3_storage_uuid"
			bind:value={values.s3_storage_uuid}
			disabled={!ready}
			required={values.save_s3 === true}
			><option value="">Select a validated destination</option
			>{#each s3Storages as storage (storage.uuid)}<option value={storage.uuid}
					>{storage.name}</option
				>{/each}</select
		></label
	>
	{#if !s3Storages.length}<p class="muted">
			No validated S3 destinations. Add or validate one in <a href={resolve('/storage')}
				>S3 storage</a
			> before enabling S3.
		</p>{/if}
	<p class="muted">
		The native backup API does not support changing the “delete local copy after upload” setting.
	</p>
	<h3>Retention</h3>
	<p class="muted">
		The first reached limit removes the oldest backup. Zero means unlimited; a blank field leaves
		the current or default limit unchanged.
	</p>
	<div class="field-grid">
		{#each retentionFields as field (field.name)}<label
				>{field.label}<input
					name={field.name}
					type="number"
					min="0"
					step={field.decimal ? 'any' : '1'}
					value={values[field.name] ?? ''}
					disabled={!ready}
					aria-invalid={errors[field.name] ? 'true' : undefined}
				/></label
			>{/each}
	</div>
	{#each Object.entries(errors) as [name, message] (name)}<p class="error">
			{name}: {message}
		</p>{/each}
	<button class="primary" disabled={!ready}
		>{create ? 'Create backup schedule' : 'Save backup schedule'}</button
	>
</form>
