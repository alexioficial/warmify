<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import '../app.css';

	let { children, data } = $props();
	const breadcrumbs = $derived(
		page.url.pathname
			.split('/')
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment).replaceAll('-', ' '))
	);

	function current(href: string): 'page' | undefined {
		return href === '/'
			? page.url.pathname === '/'
				? 'page'
				: undefined
			: page.url.pathname.startsWith(href)
				? 'page'
				: undefined;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<div class="shell">
		<aside class="sidebar">
			<a class="site-title" href={resolve('/')}>Warmify</a>
			<form class="sidebar-search" method="GET" action={resolve('/search')}>
				<label class="visually-hidden" for="global-search">Search</label>
				<input id="global-search" type="search" name="q" placeholder="Search" />
			</form>
			<nav aria-label="Main navigation">
				<p class="nav-heading">Workspace</p>
				<a href={resolve('/')} aria-current={current('/')}>Dashboard</a>
				<a href={resolve('/projects')} aria-current={current('/projects')}>Projects</a>
				<a href={resolve('/deployments')} aria-current={current('/deployments')}>Deployments</a>
				<a href={resolve('/resources')} aria-current={current('/resources')}>All resources</a>

				<p class="nav-heading">Infrastructure</p>
				<a href={resolve('/servers')} aria-current={current('/servers')}>Servers</a>
				<a href={resolve('/sources')} aria-current={current('/sources')}>Sources</a>
				<a href={resolve('/destinations')} aria-current={current('/destinations')}>Destinations</a>
				<a href={resolve('/storage')} aria-current={current('/storage')}>S3 storage</a>

				<p class="nav-heading">Manage</p>
				<a href={resolve('/teams')} aria-current={current('/teams')}>Team</a>
				<a href={resolve('/security/keys')} aria-current={current('/security/keys')}>Keys</a>
				<a href={resolve('/system')} aria-current={current('/system')}>System</a>
			</nav>
			<form class="sidebar-account" method="POST" action="/logout">
				<span>{data.user.username}</span>
				<button type="submit">Log out</button>
			</form>
		</aside>
		<div class="workspace">
			<header class="topbar">
				<div class="breadcrumbs" aria-label="Breadcrumb">
					<span>Root Team</span>
					{#each breadcrumbs as breadcrumb, index (index)}
						<span aria-hidden="true">/</span><span class="breadcrumb-value">{breadcrumb}</span>
					{/each}
				</div>
			</header>
			<main>{@render children()}</main>
		</div>
	</div>
{:else}
	<main class="public-main">{@render children()}</main>
{/if}
