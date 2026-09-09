<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { databaseNavigation } from '$lib/resource-routes';
	import { resourceSummary } from '$lib/resource-presenter';
	let { data, children } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const summary = $derived(resourceSummary(data.database, 'databases'));
	const base = $derived(`/databases/${encodeURIComponent(data.uuid)}`);
	const result = $derived(page.form as { error?: string; message?: string } | null);
	function confirm(event: MouseEvent, action: string) {
		if (!window.confirm(`${action} ${data.databaseName}?`)) event.preventDefault();
	}
</script>

<svelte:head><title>{data.databaseName} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.databaseName}</h1>
		<p class="muted">{data.overview?.engine ?? 'Database'} · {summary.status}</p>
	</div>
	<div class="actions">
		<form method="POST" action={`${base}/general?/lifecycle`}>
			<input type="hidden" name="confirmation" value="confirm" />
			<button name="action" value="start" disabled={!ready || !data.database}>Start</button>
			<button
				name="action"
				value="restart"
				disabled={!ready || !data.database}
				onclick={(event) => confirm(event, 'Restart')}>Restart</button
			>
			<button
				name="action"
				value="stop"
				disabled={!ready || !data.database}
				onclick={(event) => confirm(event, 'Stop')}>Stop</button
			>
		</form>
	</div>
</div>
{#if data.requestError}<p role="alert" class="error">{data.requestError}</p>{/if}
{#if result?.error}<p role="alert" class="error">{result.error}</p>{/if}
{#if result?.message}<p role="status">{result.message}</p>{/if}
{#if data.database}
	<div class="resource-layout">
		<nav class="resource-nav" aria-label="Database settings">
			{#each databaseNavigation(data.overview?.engine ?? 'unknown') as group (group.label)}
				<p class="nav-heading">- {group.label} -</p>
				{#each group.items as item (item.slug)}
					<a
						href={resolve(`${base}/${item.slug}` as '/')}
						aria-current={page.url.pathname === `${base}/${item.slug}` ||
						page.url.pathname.startsWith(`${base}/${item.slug}/`)
							? 'page'
							: undefined}>{item.label}</a
					>
				{/each}
			{/each}
		</nav>
		<div class="resource-content">{@render children()}</div>
	</div>
{/if}
