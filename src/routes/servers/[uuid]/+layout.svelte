<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { serverNavigation } from '$lib/resource-routes';

	let { data, children } = $props();
	const base = $derived(`/servers/${encodeURIComponent(data.uuid)}`);
	const status = $derived(
		data.server.isReachable ? (data.server.isUsable ? 'Ready' : 'Needs validation') : 'Unreachable'
	);
	const result = $derived(page.form as { error?: string; message?: string } | null);
</script>

<svelte:head><title>{data.server.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.server.name}</h1>
		<p class="muted">{data.server.ip || 'No address'} · {status}</p>
	</div>
	<a href={resolve('/servers')}>All servers</a>
</div>
{#if result?.error}<p class="error" role="alert">{result.error}</p>{/if}
{#if result?.message}<p role="status">{result.message}</p>{/if}
<div class="resource-layout">
	<nav class="resource-nav" aria-label="Server settings">
		{#each serverNavigation() as group (group.label)}
			<p class="nav-heading">- {group.label} -</p>
			{#each group.items as item (item.slug)}
				<a
					href={resolve(`${base}/${item.slug}` as '/')}
					aria-current={page.url.pathname === `${base}/${item.slug}` ? 'page' : undefined}
					>{item.label}</a
				>
			{/each}
		{/each}
	</nav>
	<div class="resource-content">{@render children()}</div>
</div>
