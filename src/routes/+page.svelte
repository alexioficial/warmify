<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import PollingData from '$lib/components/PollingData.svelte';
	import { versionLabel } from '$lib/resource-presenter';

	let { data } = $props();
</script>

<svelte:head><title>Dashboard - Warmify</title></svelte:head>

<h1>Dashboard</h1>
<p class="muted">Coolify version: {versionLabel(data.version)}</p>

<h2>Active deployments</h2>
<PollingData initial={data.deployments} url="/internal/poll/deployments/active" interval={5000} />

<div class="section-grid">
	<section>
		<h2>Projects</h2>
		<DataTable data={data.projects} detailGroup="projects" />
	</section>
	<section>
		<h2>Servers</h2>
		<DataTable data={data.servers} detailGroup="servers" />
	</section>
</div>
