<script lang="ts">
	import { onMount } from 'svelte';

	interface PageData {
		applicationName: string;
		uuid: string;
	}

	let { data }: { data: PageData } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Danger zone - Warmify</title></svelte:head>
<section class="settings-section danger-zone">
	<h2>Danger zone</h2>
	<p>Delete {data.applicationName} and choose its cleanup behavior.</p>
	<p class="error">This queues permanent deletion in Coolify and cannot be undone from Warmify.</p>
	<form method="POST" action="?/deleteApplication">
		<label class="checkbox-field">
			<input type="hidden" name="delete_configurations" value="false" />
			<input type="checkbox" name="delete_configurations" value="true" checked disabled={!ready} />
			Delete generated configurations
		</label>
		<label class="checkbox-field">
			<input type="hidden" name="delete_volumes" value="false" />
			<input type="checkbox" name="delete_volumes" value="true" checked disabled={!ready} />
			Delete persistent volumes
		</label>
		<label class="checkbox-field">
			<input type="hidden" name="docker_cleanup" value="false" />
			<input type="checkbox" name="docker_cleanup" value="true" checked disabled={!ready} />
			Run Docker cleanup
		</label>
		<label class="checkbox-field">
			<input type="hidden" name="delete_connected_networks" value="false" />
			<input
				type="checkbox"
				name="delete_connected_networks"
				value="true"
				checked
				disabled={!ready}
			/>
			Delete connected networks
		</label>
		<label>
			Type {data.applicationName} or {data.uuid} to confirm
			<input name="confirmation" autocomplete="off" disabled={!ready} required />
		</label>
		<button class="danger" type="submit" disabled={!ready}>Delete application permanently</button>
	</form>
</section>
