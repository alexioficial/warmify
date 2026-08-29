<script lang="ts">
	import AdditionalData from '$lib/components/AdditionalData.svelte';
	import { additionalData, asRecord, firstText, resourceSummary } from '$lib/resource-presenter';

	let { data } = $props();
	const record = $derived(asRecord(data.application));
	const summary = $derived(resourceSummary(data.application, 'applications'));
	const knownKeys = $derived([
		'uuid',
		'id',
		'name',
		'description',
		'status',
		'health',
		'fqdn',
		'git_repository',
		'git_branch',
		'environment',
		'environment_name',
		'server',
		'server_name',
		...data.configurationFields.map((field: { name: string }) => field.name)
	]);
	const extra = $derived(additionalData(data.application, knownKeys));
	const nested = (name: string) => firstText(asRecord(record?.[name]), ['name', 'uuid', 'id']);
</script>

<svelte:head><title>General - {summary.name} - Warmify</title></svelte:head>

<section>
	<h2>General</h2>
	<dl class="overview">
		<dt>UUID</dt>
		<dd><code>{data.uuid}</code></dd>
		<dt>Type</dt>
		<dd>{summary.type}</dd>
		<dt>Status</dt>
		<dd>{summary.status}</dd>
		{#if firstText(record, ['fqdn'])}<dt>Domains</dt>
			<dd>{firstText(record, ['fqdn'])}</dd>{/if}
		{#if firstText(record, ['git_repository'])}<dt>Repository</dt>
			<dd>{firstText(record, ['git_repository'])}</dd>{/if}
		{#if firstText(record, ['git_branch'])}<dt>Branch</dt>
			<dd>{firstText(record, ['git_branch'])}</dd>{/if}
		{#if nested('environment') || firstText(record, ['environment_name'])}<dt>Environment</dt>
			<dd>{nested('environment') || firstText(record, ['environment_name'])}</dd>{/if}
		{#if nested('server') || firstText(record, ['server_name'])}<dt>Server</dt>
			<dd>{nested('server') || firstText(record, ['server_name'])}</dd>{/if}
	</dl>
</section>

<AdditionalData data={extra} />

<details>
	<summary class="danger">Delete application</summary>
	<p class="danger">
		This cannot be undone. Type <strong>{summary.name || data.uuid}</strong> exactly.
	</p>
	<form method="POST" action="?/deleteResource">
		<label>Confirmation <input name="confirmation" required /></label>
		<button type="submit">Delete application</button>
	</form>
</details>
