<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();
	const base = $derived(`/destinations/${encodeURIComponent(data.uuid)}`);
	const result = $derived(page.form as { error?: string; message?: string } | null);
	const navigation = [
		{ slug: 'general', label: 'General' },
		{ slug: 'danger', label: 'Danger zone' }
	];
</script>

<svelte:head><title>{data.destination.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.destination.name}</h1>
		<p class="muted">
			{data.destination.network || 'Docker destination'} · {data.destination.type}
		</p>
	</div>
	<a href={resolve('/destinations')}>All destinations</a>
</div>
{#if result?.error}<p class="error" role="alert">{result.error}</p>{/if}
{#if result?.message}<p role="status">{result.message}</p>{/if}
<div class="resource-layout">
	<nav class="resource-nav" aria-label="Destination settings">
		<p class="nav-heading">- Settings -</p>
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
