<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { resourceSummary } from '$lib/resource-presenter';
	import { serviceNavigation } from '$lib/resource-routes';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const summary = $derived(resourceSummary(data.service, 'services'));
	const basePath = $derived(`/services/${encodeURIComponent(data.uuid)}`);
	const actionResult = $derived(page.form as { error?: string; message?: string } | null);
	const navigation = serviceNavigation();

	function active(slug: string): 'page' | undefined {
		if (
			slug === 'resources' &&
			(page.url.pathname.includes(`${basePath}/applications/`) ||
				page.url.pathname.includes(`${basePath}/databases/`))
		) {
			return 'page';
		}
		return page.url.pathname.includes(`${basePath}/${slug}`) ? 'page' : undefined;
	}

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ -]/)[0]}`;
	}

	function confirmLifecycle(event: MouseEvent, action: string) {
		if (!window.confirm(`${action.charAt(0).toUpperCase()}${action.slice(1)} ${summary.name}?`)) {
			event.preventDefault();
		}
	}
</script>

<svelte:head><title>{summary.name} - Warmify</title></svelte:head>

<div class="resource-heading page-header">
	<div>
		<h1>{summary.name}</h1>
		<div class="actions">
			<span class={statusClass(summary.status)}>{summary.status}</span>
			{#if summary.description}<span class="muted">{summary.description}</span>{/if}
		</div>
	</div>
	<div class="actions">
		{#each data.overview?.links ?? [] as link, index (index)}
			<a href={link.url} target="_blank" rel="noopener noreferrer">{link.name} ↗</a>
		{/each}
		<form class="action-form" method="POST" action={`${basePath}/general?/lifecycle`}>
			<button class="primary" name="action" value="start" disabled={!ready || !data.service}
				>Deploy</button
			>
		</form>
		<form class="action-form" method="POST" action={`${basePath}/general?/lifecycle`}>
			<input type="hidden" name="confirmation" value="confirm" />
			<button
				name="action"
				value="restart"
				disabled={!ready || !data.service}
				onclick={(event) => confirmLifecycle(event, 'restart')}>Restart</button
			>
			<button
				name="action"
				value="stop"
				disabled={!ready || !data.service}
				onclick={(event) => confirmLifecycle(event, 'stop')}>Stop</button
			>
		</form>
	</div>
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if actionResult?.error}<p class="error" role="alert">{actionResult.error}</p>{/if}
{#if actionResult?.message}<p role="status">{actionResult.message}</p>{/if}

{#if data.service}
	<div class="resource-layout">
		<nav class="resource-nav" aria-label="Service settings">
			{#each navigation as group (group.label)}
				<p class="nav-heading">- {group.label} -</p>
				{#each group.items as item (item.slug)}
					<a href={resolve(`${basePath}/${item.slug}` as '/')} aria-current={active(item.slug)}
						>{item.label}</a
					>
				{/each}
			{/each}
		</nav>
		<div class="resource-content">{@render children()}</div>
	</div>
{/if}
