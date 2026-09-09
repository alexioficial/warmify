<script lang="ts">
	import { resolve } from '$app/paths';
	import DeploymentForm from '$lib/components/DeploymentForm.svelte';
	let { form } = $props();
</script>

<svelte:head><title>New deployment - Warmify</title></svelte:head>
<div class="page-header">
	<h1>New deployment</h1>
	<a href={resolve('/deployments')}>Active deployments</a>
</div>
{#key form}<DeploymentForm {form} />{/key}
