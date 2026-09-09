<script lang="ts">
	import { onMount } from 'svelte';
	import ScheduledTaskTable from '$lib/components/ScheduledTaskTable.svelte';
	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	function createValue(name: string, fallback: string | number) {
		return form?.target === 'create' && form.values?.[name] !== undefined
			? String(form.values[name])
			: String(fallback);
	}
</script>

<svelte:head><title>Service scheduled tasks - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<h2>Scheduled tasks</h2>
	<p class="muted">Run recurring commands and inspect execution history.</p>
	<ScheduledTaskTable tasks={data.tasks} {form} {ready} />
	<details>
		<summary>Add task</summary>
		<form method="POST" action="?/createTask">
			<label
				>Name <input
					name="name"
					value={createValue('name', '')}
					disabled={!ready}
					required
				/></label
			>
			<label
				>Schedule <input
					name="frequency"
					value={createValue('frequency', '0 0 * * *')}
					disabled={!ready}
					required
				/></label
			>
			<label
				>Container <span class="muted">(optional)</span><input
					name="container"
					value={createValue('container', '')}
					disabled={!ready}
				/></label
			>
			<label
				>Timeout (seconds) <input
					type="number"
					name="timeout"
					min="1"
					value={createValue('timeout', 300)}
					disabled={!ready}
					required
				/></label
			>
			<label
				>Command <textarea name="command" disabled={!ready} required
					>{createValue('command', '')}</textarea
				></label
			>
			<label class="checkbox-field"
				><input type="hidden" name="enabled" value="false" /><input
					type="checkbox"
					name="enabled"
					value="true"
					checked
					disabled={!ready}
				/>Enabled</label
			>
			<button class="primary" type="submit" disabled={!ready}>Add task</button>
		</form>
	</details>
</section>
