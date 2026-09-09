<script lang="ts">
	import { onMount } from 'svelte';

	import ScheduledTaskTable from '$lib/components/ScheduledTaskTable.svelte';
	import type { ScheduledTaskSummary } from '$lib/server/scheduled-task-actions';

	interface TaskActionResult {
		error?: string;
		message?: string;
		target?: string;
		operation?: string;
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean | number>;
	}

	interface ScheduledTaskPageData {
		applicationName: string;
		tasks: ScheduledTaskSummary[];
		requestError?: string;
	}

	let { data, form }: { data: ScheduledTaskPageData; form: TaskActionResult | null } = $props();
	let ready = $state(false);

	onMount(() => {
		ready = true;
	});

	function createValue(name: string, fallback: string | number) {
		return form?.target === 'create' && form.values?.[name] !== undefined
			? String(form.values[name])
			: String(fallback);
	}
</script>

<svelte:head><title>Scheduled tasks - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Scheduled tasks</h2>
			<p class="muted">Run recurring commands and inspect their execution history.</p>
		</div>
	</div>

	<ScheduledTaskTable tasks={data.tasks} {form} {ready} />

	<details>
		<summary>Add task</summary>
		<form method="POST" action="?/createTask">
			<label>
				Name
				<input name="name" value={createValue('name', '')} disabled={!ready} required />
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.name}
				<p class="error">{form.fieldErrors.name}</p>
			{/if}

			<label>
				Schedule
				<input
					name="frequency"
					value={createValue('frequency', '0 0 * * *')}
					placeholder="0 0 * * *"
					disabled={!ready}
					required
				/>
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.frequency}
				<p class="error">{form.fieldErrors.frequency}</p>
			{/if}

			<label>
				Container <span class="muted">(optional)</span>
				<input name="container" value={createValue('container', '')} disabled={!ready} />
			</label>

			<label>
				Timeout (seconds)
				<input
					type="number"
					name="timeout"
					min="1"
					value={createValue('timeout', 300)}
					disabled={!ready}
					required
				/>
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.timeout}
				<p class="error">{form.fieldErrors.timeout}</p>
			{/if}

			<label>
				Command
				<textarea name="command" disabled={!ready} required>{createValue('command', '')}</textarea>
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.command}
				<p class="error">{form.fieldErrors.command}</p>
			{/if}

			<label class="checkbox-field">
				<input type="hidden" name="enabled" value="false" />
				<input
					type="checkbox"
					name="enabled"
					value="true"
					checked={form?.target === 'create' ? form.values?.enabled !== false : true}
					disabled={!ready}
				/>
				Enabled
			</label>

			<button class="primary" type="submit" disabled={!ready}>Add task</button>
		</form>
	</details>
</section>
