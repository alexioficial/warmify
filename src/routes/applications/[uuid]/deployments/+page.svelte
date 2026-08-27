<script lang="ts">
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	let { data } = $props();
</script>
<svelte:head><title>Deployments - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section><h2>Deployments</h2><DeploymentTable data={data.deployments} /></section>
