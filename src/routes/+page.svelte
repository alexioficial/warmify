<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import { resolve } from '$app/paths';
	import { versionLabel } from '$lib/resource-presenter';

	let { data } = $props();
	let refreshed = $state<{ value: typeof data }>();
	const dashboard = $derived(refreshed ? refreshed.value : data);
</script>

<svelte:head><title>Dashboard - Warmify</title></svelte:head>

<div class="page-header">
	<div>
		<h1>Dashboard</h1>
		<p class="muted">Coolify {versionLabel(dashboard.version)}</p>
	</div>
</div>

<CollectionSynchronizer
	url="/internal/poll/dashboard"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = { value: value as typeof data })}
/>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Deployments</h2>
			<p class="muted">Active and recent deployment activity</p>
		</div>
		<a href={resolve('/deployments')}>View all</a>
	</div>
	<DeploymentTable data={dashboard.deployments} pollUrl="/internal/poll/deployments/active" />
</section>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Projects</h2>
			<p class="muted">Your deployment workspaces</p>
		</div>
		<a href={resolve('/projects')}>View all</a>
	</div>
	<ProjectGrid data={dashboard.projects} />
</section>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Servers</h2>
			<p class="muted">Infrastructure available for deployments</p>
		</div>
		<a href={resolve('/servers')}>View all</a>
	</div>
	<DataTable data={dashboard.servers} detailGroup="servers" />
</section>
