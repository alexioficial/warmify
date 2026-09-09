<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Service danger zone - Warmify</title></svelte:head>
<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p class="error">Deletion is permanent and may destroy persistent data.</p>
	<form method="POST" action="?/deleteService">
		{#each [{ name: 'delete_configurations', label: 'Delete generated configurations' }, { name: 'delete_volumes', label: 'Delete persistent volumes' }, { name: 'docker_cleanup', label: 'Run Docker cleanup' }, { name: 'delete_connected_networks', label: 'Delete connected networks' }] as flag (flag.name)}
			<label class="checkbox-field"
				><input type="hidden" name={flag.name} value="false" /><input
					type="checkbox"
					name={flag.name}
					value="true"
					checked
					disabled={!ready}
				/>{flag.label}</label
			>
		{/each}
		<label
			>Type {data.serviceName} or {data.uuid} to confirm
			<input name="confirmation" autocomplete="off" required disabled={!ready} /></label
		>
		<button class="danger" disabled={!ready}>Delete service permanently</button>
	</form>
</section>
