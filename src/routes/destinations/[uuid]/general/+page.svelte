<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<section class="settings-section">
	<h2>General</h2>
	<form method="POST" action="?/update">
		<label
			>Name<input
				name="name"
				maxlength="255"
				required
				value={data.destination.name}
				disabled={!ready}
			/></label
		>
		<div class="form-grid">
			<label>Docker network<input value={data.destination.network} readonly /></label>
			<label>Type<input value={data.destination.type} readonly /></label>
		</div>
		{#if data.destination.serverUuid}
			<p>
				Server: <a href={resolve(`/servers/${data.destination.serverUuid}/destinations`)}
					>{data.destination.serverUuid}</a
				>
			</p>
		{/if}
		<button class="primary" disabled={!ready}>Save destination</button>
	</form>
</section>
