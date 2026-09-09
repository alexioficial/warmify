<script lang="ts">
	import { resolve } from '$app/paths';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Deployments - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Deployments</h1>
		<p class="muted">
			Active application deployments. Open an application’s Deployments page for its history.
		</p>
	</div>
	<a class="button primary" href={resolve('/deployments/new')}>New deployment</a>
</div>
{#key data}
	<DeploymentTable
		data={data.deployments}
		initialError={data.requestError ? { message: data.requestError, retryable: true } : undefined}
		pollUrl="/internal/poll/deployments/active"
		pollWhenEmpty
		refreshOnMount
		showApplication
	/>
{/key}
