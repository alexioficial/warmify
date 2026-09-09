<script lang="ts">
	import DeploymentDetail from '$lib/components/DeploymentDetail.svelte';

	let { data, form } = $props();
</script>

{#key data}{#key form}<DeploymentDetail {data} {form} />{/key}{/key}
