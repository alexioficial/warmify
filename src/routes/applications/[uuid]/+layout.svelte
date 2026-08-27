<script lang="ts">
	import { page } from '$app/state';
	import { resourceSummary } from '$lib/resource-presenter';

	let { data, children } = $props();
	const summary = $derived(resourceSummary(data.application, 'applications'));
	const basePath = $derived(`/applications/${encodeURIComponent(data.uuid)}`);
	const actionResult = $derived(page.form as { error?: string; message?: string } | null);

	const settings = [
		{ slug: 'general', label: 'General' },
		{ slug: 'application-details', label: 'Application details' },
		{ slug: 'access', label: 'Access' },
		{ slug: 'build-pipeline', label: 'Build pipeline' },
		{ slug: 'networking', label: 'Networking' },
		{ slug: 'healthcheck', label: 'Healthcheck' },
		{ slug: 'environment-variables', label: 'Environment variables' },
		{ slug: 'persistent-storage', label: 'Persistent storage' },
		{ slug: 'scheduled-tasks', label: 'Scheduled tasks' }
	] as const;
	const observe = [
		{ slug: 'deployments', label: 'Deployments' },
		{ slug: 'runtime-logs', label: 'Runtime logs' }
	] as const;

	function active(slug: string): 'page' | undefined {
		return page.url.pathname.endsWith(`/${slug}`) ? 'page' : undefined;
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
		<form class="action-form" method="POST" action={`${basePath}/general?/lifecycle`}>
			<button name="action" value="start">Start</button>
			<button class="primary" name="action" value="deploy">Deploy</button>
		</form>
		<form class="action-form" method="POST" action={`${basePath}/general?/lifecycle`}>
			<input type="hidden" name="confirmation" value="confirm" />
			<button name="action" value="restart" onclick={(event) => confirmLifecycle(event, 'restart')}>Restart</button>
			<button name="action" value="stop" onclick={(event) => confirmLifecycle(event, 'stop')}>Stop</button>
		</form>
	</div>
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if actionResult?.error}<p class="error" role="alert">{actionResult.error}</p>{/if}
{#if actionResult?.message}<p role="status">{actionResult.message}</p>{/if}

{#if data.application}
	<div class="resource-layout">
		<nav class="resource-nav" aria-label="Application settings">
			<p class="nav-heading">- Settings -</p>
			{#each settings as item (item.slug)}
				<a href={`${basePath}/${item.slug}`} aria-current={active(item.slug)}>{item.label}</a>
			{/each}
			<p class="nav-heading">- Observe & troubleshoot -</p>
			{#each observe as item (item.slug)}
				<a href={`${basePath}/${item.slug}`} aria-current={active(item.slug)}>{item.label}</a>
			{/each}
		</nav>
		<div class="resource-content">{@render children()}</div>
	</div>
{/if}
