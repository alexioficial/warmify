<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import '../app.css';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<header>
		<a class="site-title" href={resolve('/')}>Warmify</a>
		<form method="POST" action="/logout">
			<span>{data.user.username}</span>
			<button type="submit">Log out</button>
		</form>
	</header>
	<div class="shell">
		<nav aria-label="Main navigation">
			<a href={resolve('/')}>Dashboard</a>
			<a href={resolve('/manage/[group]', { group: 'projects' })}>Projects</a>
			<a href={resolve('/manage/[group]', { group: 'deployments' })}>Deployments</a>
			<a href={resolve('/manage/[group]', { group: 'servers' })}>Servers</a>
			<a href={resolve('/manage/[group]', { group: 'sources' })}>Sources</a>
			<a href={resolve('/manage/[group]', { group: 'destinations' })}>Destinations</a>
			<a href={resolve('/manage/[group]', { group: 'storage' })}>S3 storage</a>
			<a href={resolve('/manage/[group]', { group: 'security' })}>Keys</a>
			<a href={resolve('/manage/[group]', { group: 'teams' })}>Teams</a>
			<a href={resolve('/manage/[group]', { group: 'system' })}>System</a>
			<a href={resolve('/search')}>Search</a>
		</nav>
		<main>{@render children()}</main>
	</div>
{:else}
	<main class="public-main">{@render children()}</main>
{/if}
