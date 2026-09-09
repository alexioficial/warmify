<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<h2>General</h2>
<p class="muted">Connection details used by Coolify to manage this server.</p>
<form method="POST" action="?/updateGeneral" use:enhance>
	<label
		>Name<input
			name="name"
			value={data.server.name}
			required
			maxlength="255"
			disabled={!ready}
		/></label
	>
	<label
		>Description<textarea name="description" rows="3" disabled={!ready}
			>{data.server.description}</textarea
		></label
	>
	<div class="form-grid">
		<label
			>IP address or hostname<input
				name="ip"
				value={data.server.ip}
				required
				disabled={!ready}
			/></label
		>
		<label
			>SSH port<input
				name="port"
				type="number"
				min="1"
				max="65535"
				value={data.server.port ?? 22}
				required
				disabled={!ready}
			/></label
		>
		<label
			>SSH user<input
				name="user"
				value={data.server.user || 'root'}
				required
				disabled={!ready}
			/></label
		>
	</div>
	<button class="primary" disabled={!ready}>Save server</button>
</form>
<section class="settings-section" aria-label="Server status">
	<h2>Status</h2>
	<dl class="overview">
		<dt>Reachable</dt>
		<dd>{data.server.isReachable ? 'Yes' : 'No'}</dd>
		<dt>Usable</dt>
		<dd>{data.server.isUsable ? 'Yes' : 'No'}</dd>
		<dt>Build server</dt>
		<dd>{data.server.isBuildServer ? 'Yes' : 'No'}</dd>
		<dt>Proxy</dt>
		<dd>{data.server.proxyType || 'Not configured'}</dd>
	</dl>
</section>
