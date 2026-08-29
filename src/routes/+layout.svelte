<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import '../app.css';

	interface Breadcrumb {
		label: string;
		href: string;
	}

	let { children, data } = $props();
	const activePath = $derived(navigating.to?.url.pathname ?? page.url.pathname);
	const loadingPage = $derived(navigating.to !== null);
	const routeBreadcrumbs = $derived.by(() => {
		const result: Breadcrumb[] = [];
		const parts = activePath.split('/').filter(Boolean);
		let href = '';
		for (const segment of parts) {
			href += `/${segment}`;
			if (['environments', 'new'].includes(segment)) continue;
			result.push({
				label: decodeURIComponent(segment).replaceAll('-', ' '),
				href
			});
		}
		return result;
	});
	const dataBreadcrumbs = $derived(
		Array.isArray(page.data.breadcrumbs)
			? page.data.breadcrumbs
					.map((item) => {
						if (typeof item === 'string') return { label: item, href: page.url.pathname };
						if (
							item &&
							typeof item === 'object' &&
							typeof item.label === 'string' &&
							typeof item.href === 'string'
						) {
							return { label: item.label, href: item.href };
						}
					})
					.filter((item): item is Breadcrumb => item !== undefined)
			: []
	);
	const breadcrumbs = $derived.by(() => {
		return dataBreadcrumbs.length ? dataBreadcrumbs : routeBreadcrumbs;
	});

	function current(href: string): 'page' | undefined {
		return href === '/'
			? activePath === '/'
				? 'page'
				: undefined
			: activePath.startsWith(href)
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
				<p class="nav-heading">- Workspace -</p>
				<a href={resolve('/')} aria-current={current('/')}>Dashboard</a>
				<a href={resolve('/projects')} aria-current={current('/projects')}>Projects</a>
				<a href={resolve('/deployments')} aria-current={current('/deployments')}>Deployments</a>

				<p class="nav-heading">- Infrastructure -</p>
				<a href={resolve('/servers')} aria-current={current('/servers')}>Servers</a>
				<a href={resolve('/sources')} aria-current={current('/sources')}>Sources</a>
				<a href={resolve('/destinations')} aria-current={current('/destinations')}>Destinations</a>
				<a href={resolve('/storage')} aria-current={current('/storage')}>S3 storage</a>

				<p class="nav-heading">- Manage -</p>
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
					<a href={resolve('/')}>Root Team</a>
					{#each breadcrumbs as breadcrumb, index (index)}
						<span aria-hidden="true">/</span><a
							class="breadcrumb-value"
							href={resolve(breadcrumb.href as '/')}>{breadcrumb.label}</a
						>
					{/each}
				</div>
			</header>
			<main>
				{#if loadingPage}
					<PageSkeleton />
				{:else}
					{@render children()}
				{/if}
			</main>
		</div>
	</div>
{:else}
	<main class="public-main">{@render children()}</main>
{/if}
