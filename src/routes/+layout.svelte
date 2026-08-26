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
			<a href={resolve('/projects')}>Projects</a>
			<a href={resolve('/deployments')}>Deployments</a>
			<a href={resolve('/servers')}>Servers</a>
			<a href={resolve('/sources')}>Sources</a>
			<a href={resolve('/destinations')}>Destinations</a>
			<a href={resolve('/storage')}>S3 storage</a>
			<a href={resolve('/security/keys')}>Keys</a>
			<a href={resolve('/teams')}>Teams</a>
			<a href={resolve('/system')}>System</a>
			<a href={resolve('/search')}>Search</a>
		</nav>
		<main>{@render children()}</main>
	</div>
{:else}
	<main class="public-main">{@render children()}</main>
{/if}
