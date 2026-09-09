<script lang="ts">
	import { resolve } from '$app/paths';
	import { teamCollection, type TeamView } from '$lib/administration-presenter';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';

	let { data } = $props();
	let refreshed = $state<TeamView[]>();
	const teams = $derived(refreshed ?? data.teams);
</script>

<svelte:head><title>Team - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Team</h1>
		<p class="muted">The team bound to the configured Coolify API token.</p>
	</div>
</div>
<CollectionSynchronizer
	url="/internal/poll/collections/teams"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = teamCollection(value))}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if teams.length}
	<div class="card-grid">
		{#each teams as team (team.id)}
			<a class="resource-card" href={resolve(`/teams/${team.id}` as '/')}>
				<h2>{team.name}</h2>
				<p>{team.description || 'No description'}</p>
				<p class="muted">{team.personalTeam ? 'Personal team' : 'Shared team'}</p>
			</a>
		{/each}
	</div>
{:else if !data.requestError}<p>No team is available to this token.</p>{/if}
