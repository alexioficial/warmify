<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	let configuration = $state('');
	let configurationVisible = $state(false);
	let configurationMessage = $state('');
	let revealing = $state(false);
	onMount(() => (ready = true));

	async function revealConfiguration() {
		revealing = true;
		configurationMessage = '';
		try {
			const response = await fetch(`${page.url.pathname}/reveal`, {
				method: 'POST',
				cache: 'no-store'
			});
			const result = await response.json();
			if (!response.ok || typeof result.configuration !== 'string')
				throw new Error(result.message ?? 'Configuration unavailable.');
			configuration = result.configuration;
			configurationVisible = true;
		} catch (caught) {
			configurationMessage =
				caught instanceof Error ? caught.message : 'Proxy configuration could not be revealed.';
		} finally {
			revealing = false;
		}
	}

	function hideConfiguration() {
		configuration = '';
		configurationVisible = false;
		configurationMessage = '';
	}
</script>

<h2>Proxy</h2>
<p class="muted">
	Configure the server proxy. Raw Compose configuration is loaded only after an explicit sensitive
	read.
</p>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<dl class="overview">
	<dt>Status</dt>
	<dd>{data.proxy.status}</dd>
	<dt>Configuration</dt>
	<dd>{data.proxy.configurationAvailable ? 'Stored' : 'Unavailable'}</dd>
</dl>

<form method="POST" action="?/update" use:enhance>
	<fieldset disabled={!ready}>
		<legend>Proxy settings</legend>
		<label
			>Proxy type<select name="proxy_type" value={data.proxy.type}>
				<option value="traefik">Traefik</option>
				<option value="caddy">Caddy</option>
				<option value="nginx">Nginx</option>
				<option value="none">None</option>
			</select></label
		>
		<label
			>Redirect URL<input
				name="redirect_url"
				type="url"
				value={data.proxy.redirectUrl}
				placeholder="https://example.com"
			/></label
		>
		<input type="hidden" name="redirect_enabled" value="false" />
		<label class="checkbox-field">
			<input
				type="checkbox"
				name="redirect_enabled"
				value="true"
				checked={data.proxy.redirectEnabled}
			/>Enable the default redirect
		</label>
		<input type="hidden" name="generate_exact_labels" value="false" />
		<label class="checkbox-field">
			<input
				type="checkbox"
				name="generate_exact_labels"
				value="true"
				checked={data.proxy.generateExactLabels}
			/>Generate exact proxy labels
		</label>
	</fieldset>
	<button class="primary" disabled={!ready}>Save proxy settings</button>
</form>

<section class="settings-section">
	<h3>Raw proxy configuration</h3>
	{#if configurationVisible}
		<form
			method="POST"
			action="?/saveConfiguration"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: result.type === 'success' });
					if (result.type === 'success') hideConfiguration();
				}}
		>
			<label
				>Docker Compose configuration<textarea
					name="configuration"
					rows="18"
					bind:value={configuration}
					required
					disabled={!ready}></textarea></label
			>
			<button class="primary" disabled={!ready}>Save proxy configuration</button>
			<button type="button" onclick={hideConfiguration}>Hide configuration</button>
		</form>
	{:else}
		<button type="button" onclick={revealConfiguration} disabled={!ready || revealing}
			>{revealing ? 'Revealing…' : 'Reveal configuration'}</button
		>
	{/if}
	{#if configurationMessage}<p class="error" role="alert">{configurationMessage}</p>{/if}
</section>

<section class="settings-section">
	<h3>Restart proxy</h3>
	<p>Queues one proxy restart. Warmify does not retry this operation.</p>
	<form method="POST" action="?/restart" use:enhance>
		<label
			>Type <strong>RESTART PROXY</strong> to confirm<input
				name="confirmation"
				autocomplete="off"
				required
				disabled={!ready}
			/></label
		>
		<button class="danger" disabled={!ready}>Restart proxy</button>
	</form>
</section>
