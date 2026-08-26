<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import PollingData from '$lib/components/PollingData.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import { resolve } from '$app/paths';
	import { versionLabel } from '$lib/resource-presenter';

	let { data } = $props();
</script>

<svelte:head><title>Dashboard - Warmify</title></svelte:head>

<div class="page-header">
	<div>
		<h1>Dashboard</h1>
		<p class="muted">Coolify {versionLabel(data.version)}</p>
	</div>
</div>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Deployments</h2>
			<p class="muted">Active and recent deployment activity</p>
		</div>
		<a href={resolve('/deployments')}>View all</a>
	</div>
	<PollingData initial={data.deployments} url="/internal/poll/deployments/active" interval={5000} />
</section>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Projects</h2>
			<p class="muted">Your deployment workspaces</p>
		</div>
		<a href={resolve('/projects')}>View all</a>
	</div>
	<ProjectGrid data={data.projects} />
</section>

<section class="dashboard-section">
	<div class="section-heading">
		<div class="section-title">
			<h2>Servers</h2>
			<p class="muted">Infrastructure available for deployments</p>
		</div>
		<a href={resolve('/servers')}>View all</a>
	</div>
	<DataTable data={data.servers} detailGroup="servers" />
</section>
