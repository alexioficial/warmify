<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();
	const base = $derived(`/sources/${data.provider}/${data.id}`);
	const result = $derived(page.form as { error?: string; message?: string } | null);
	const navigation = $derived([
		{ slug: 'general', label: 'General' },
		...(data.provider === 'github' && data.source.owned
			? [{ slug: 'repositories', label: 'Repositories' }]
			: []),
		...(data.source.owned ? [{ slug: 'danger', label: 'Danger zone' }] : [])
	]);
</script>

<svelte:head><title>{data.source.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.source.name}</h1>
		<p class="muted">
			{data.provider === 'github' ? 'GitHub App' : 'GitLab App'} · {data.source.isSystemWide
				? 'System-wide'
				: 'Team source'}
		</p>
	</div>
	<a href={resolve('/sources')}>All sources</a>
</div>
{#if !data.source.owned}
	<p class="notice" role="status">
		This system-wide source belongs to another team and is read-only here.
	</p>
{/if}
{#if result?.error}<p class="error" role="alert">{result.error}</p>{/if}
{#if result?.message}<p role="status">{result.message}</p>{/if}
<div class="resource-layout">
	<nav class="resource-nav" aria-label="Source settings">
		<p class="nav-heading">- Source -</p>
		{#each navigation as item (item.slug)}
			<a
				href={resolve(`${base}/${item.slug}` as '/')}
				aria-current={page.url.pathname === `${base}/${item.slug}` ? 'page' : undefined}
				>{item.label}</a
			>
		{/each}
	</nav>
	<div class="resource-content">{@render children()}</div>
</div>
