<script lang="ts">
	import ApplicationConfigurationSection from './ApplicationConfigurationSection.svelte';
	import { resourceSummary } from '../resource-presenter';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const summary = $derived(resourceSummary(data.resource, data.kind));
	const lifecycleAction = $derived(
		data.kind === 'applications'
			? `/services/${encodeURIComponent(data.uuid)}/applications/${encodeURIComponent(data.resourceUuid)}?/lifecycle`
			: `/services/${encodeURIComponent(data.uuid)}/databases/${encodeURIComponent(data.resourceUuid)}?/lifecycle`
	);

	function confirmLifecycle(event: MouseEvent, action: string) {
		if (!window.confirm(`${action.charAt(0).toUpperCase()}${action.slice(1)} ${summary.name}?`)) {
			event.preventDefault();
		}
	}
</script>

<div class="page-header">
	<div>
		<h2>{data.resourceName}</h2>
		<p class="muted">
			{data.kind === 'applications' ? 'Service application' : 'Service database'} · {summary.status}
		</p>
	</div>
	<div class="actions">
		<form class="action-form" method="POST" action={lifecycleAction}>
			<button class="primary" name="action" value="start" disabled={!ready}>Deploy</button>
		</form>
		<form class="action-form" method="POST" action={lifecycleAction}>
			<input type="hidden" name="confirmation" value="confirm" />
			<button
				name="action"
				value="restart"
				disabled={!ready}
				onclick={(event) => confirmLifecycle(event, 'restart')}>Restart</button
			>
			<button
				name="action"
				value="stop"
				disabled={!ready}
				onclick={(event) => confirmLifecycle(event, 'stop')}>Stop</button
			>
		</form>
	</div>
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if data.resource}
	<p>
		<a
			href={resolve(
				`/services/${encodeURIComponent(data.uuid)}/runtime-logs?sub_service_name=${encodeURIComponent(String(data.resource.name ?? ''))}`
			)}>Runtime logs for this container</a
		>
	</p>
	<ApplicationConfigurationSection
		application={data.resource}
		configurationFields={data.configurationFields}
		title="Configuration"
		section="configuration"
		{form}
	/>
{/if}
