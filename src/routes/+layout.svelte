<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import { beforeNavigate, goto, pushState, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import '../app.css';

	let { children, data } = $props();
	let earlyNavigation = $state<URL | null>(null);
	let committingEarlyNavigation = false;
	const activePath = $derived(
		earlyNavigation?.pathname ?? navigating.to?.url.pathname ?? page.url.pathname
	);
	const loadingPage = $derived(earlyNavigation !== null || navigating.to !== null);
	const breadcrumbs = $derived(
		activePath
			.split('/')
			.filter(Boolean)
			.map((segment) => decodeURIComponent(segment).replaceAll('-', ' '))
	);

	function current(href: string): 'page' | undefined {
		return href === '/'
			? activePath === '/'
				? 'page'
				: undefined
			: activePath.startsWith(href)
				? 'page'
				: undefined;
	}

	beforeNavigate((navigation) => {
		if (
			committingEarlyNavigation ||
			navigation.type !== 'link' ||
			navigation.willUnload ||
			!navigation.to ||
			navigation.to.route.id === null ||
			navigation.to.url.href === page.url.href
		) {
			return;
		}

		navigation.cancel();
		committingEarlyNavigation = true;

		const target = new URL(navigation.to.url);
		const previousUrl = new URL(page.url);
		const previousState = page.state;
		earlyNavigation = target;
		pushState(target, previousState);

		void goto(target, { replaceState: true, state: previousState })
			.catch(() => {
				if (location.href === target.href && page.url.href === previousUrl.href) {
					replaceState(previousUrl, previousState);
				}
			})
			.finally(() => {
				earlyNavigation = null;
				committingEarlyNavigation = false;
			});
	});
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
				<a href={resolve('/resources')} aria-current={current('/resources')}>All resources</a>

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
					<span>Root Team</span>
					{#each breadcrumbs as breadcrumb, index (index)}
						<span aria-hidden="true">/</span><span class="breadcrumb-value">{breadcrumb}</span>
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
