<script lang="ts">
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Deployments - {data.applicationName} - Warmify</title></svelte:head>
<section>
	<h2>Deployments</h2>
	<p class="muted">Active deployments refresh every five seconds while this tab is visible.</p>
	<DeploymentTable
		data={data.deployments}
		pollUrl={`/internal/poll/application-deployments/${encodeURIComponent(data.uuid)}`}
		initialError={data.requestFailure}
	/>
</section>
