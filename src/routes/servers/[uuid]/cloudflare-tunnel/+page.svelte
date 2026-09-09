<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<h2>Cloudflare Tunnel</h2>
<p class="muted">
	These public API actions only mark the stored/manual tunnel state. They do not deploy or remove a
	cloudflared process on the server.
</p>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<dl class="overview">
	<dt>Stored state</dt>
	<dd>{data.tunnel.enabled ? 'Enabled' : 'Disabled'}</dd>
	<dt>Current server address</dt>
	<dd>{data.tunnel.ip || 'Unknown'}</dd>
	<dt>Previous address</dt>
	<dd>{data.tunnel.previousIp || 'Unavailable'}</dd>
</dl>

<section class="settings-section">
	<h3>{data.tunnel.enabled ? 'Disable stored tunnel state' : 'Enable stored tunnel state'}</h3>
	{#if data.server.isCoolifyHost}
		<p>The local Coolify host cannot use this action.</p>
	{:else}
		<form method="POST" action={data.tunnel.enabled ? '?/disable' : '?/enable'} use:enhance>
			<label
				>Type <strong>{data.tunnel.enabled ? 'DISABLE TUNNEL' : 'ENABLE TUNNEL'}</strong> to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready}
				/></label
			>
			<button class="danger" disabled={!ready}
				>{data.tunnel.enabled ? 'Disable tunnel state' : 'Enable tunnel state'}</button
			>
		</form>
	{/if}
</section>
