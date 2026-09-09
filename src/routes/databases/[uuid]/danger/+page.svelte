<script lang="ts">
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Database danger zone - Warmify</title></svelte:head>
<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p class="error">
		Deletion is permanent. Deleting persistent volumes destroys the database's stored data.
	</p>
	<p class="muted">
		Unchecked cleanup options preserve those Docker resources, but do not preserve the database
		record in Coolify.
	</p>
	<form method="POST" action="?/deleteDatabase">
		{#each [{ name: 'delete_configurations', label: 'Delete generated configurations' }, { name: 'delete_volumes', label: 'Delete persistent volumes' }, { name: 'docker_cleanup', label: 'Run Docker cleanup' }, { name: 'delete_connected_networks', label: 'Delete connected networks' }] as flag (flag.name)}
			<label class="checkbox-field"
				><input type="hidden" name={flag.name} value="false" /><input
					type="checkbox"
					name={flag.name}
					value="true"
					disabled={!ready}
				/>{flag.label}</label
			>
		{/each}
		<label
			>Type {data.databaseName} or {data.uuid} to confirm
			<input name="confirmation" autocomplete="off" required disabled={!ready} /></label
		>
		<button class="danger" disabled={!ready}>Delete database permanently</button>
	</form>
</section>
