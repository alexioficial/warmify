<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import ServerSecretReveal from '$lib/components/ServerSecretReveal.svelte';
	let { data } = $props();
	let ready = $state(false);
	let urlMode = $state('keep');
	onMount(() => {
		ready = true;
	});
</script>

<h2>Sentinel</h2>
<p class="muted">
	Monitor server activity and configure metrics collection. Disabling Sentinel also disables metrics
	and debug mode.
</p>
{#if data.requestError}<p role="alert" class="error">{data.requestError}</p>{/if}
<p>Last update: {data.sentinel.updatedAt || 'Unavailable'}</p>
<form method="POST" action="?/update" use:enhance>
	<fieldset disabled={!ready || !!data.requestError}>
		<legend>Monitoring</legend>
		{#each [{ name: 'is_sentinel_enabled', label: 'Enable Sentinel', checked: data.sentinel.enabled }, { name: 'is_metrics_enabled', label: 'Collect metrics', checked: data.sentinel.metricsEnabled }, { name: 'is_sentinel_debug_enabled', label: 'Enable debug mode', checked: data.sentinel.debugEnabled }] as option (option.name)}
			<input type="hidden" name={option.name} value="false" />
			<label class="checkbox-field"
				><input
					type="checkbox"
					name={option.name}
					value="true"
					checked={option.checked}
				/>{option.label}</label
			>
		{/each}
		{#if data.server.isBuildServer}<p>
				Sentinel cannot be enabled on a dedicated build server.
			</p>{/if}
		<div class="form-grid">
			<label
				>Metrics refresh (seconds)<input
					type="number"
					name="sentinel_metrics_refresh_rate_seconds"
					min="1"
					required
					value={data.sentinel.refreshRate}
				/></label
			>
			<label
				>Metrics history (days)<input
					type="number"
					name="sentinel_metrics_history_days"
					min="1"
					required
					value={data.sentinel.historyDays}
				/></label
			>
			<label
				>Push interval (seconds)<input
					type="number"
					name="sentinel_push_interval_seconds"
					min="10"
					required
					value={data.sentinel.pushInterval}
				/></label
			>
		</div>
		<label
			>Replacement token<input
				type="password"
				name="sentinel_token"
				maxlength="500"
				autocomplete="new-password"
			/></label
		>
		<p class="muted">Leave blank to keep the existing token.</p>
		<label
			>Custom URL<select name="sentinel_custom_url_mode" bind:value={urlMode}
				><option value="keep">Keep existing URL</option><option value="replace">Replace URL</option
				><option value="clear">Clear URL</option></select
			></label
		>
		{#if urlMode === 'replace'}<label
				>Replacement URL<input
					type="url"
					name="sentinel_custom_url"
					required
					autocomplete="off"
				/></label
			>{/if}
		<p>Saving may restart Sentinel.</p>
		<label
			>Type SAVE SENTINEL to confirm<input name="confirmation" required autocomplete="off" /></label
		>
		<button class="primary">Save Sentinel settings</button>
	</fieldset>
</form>
<section class="settings-section">
	<h3>Stored secrets</h3>
	<ServerSecretReveal
		url={`/servers/${encodeURIComponent(data.uuid)}/sentinel/reveal`}
		fields={[
			{ key: 'token', label: 'Token' },
			{ key: 'customUrl', label: 'Custom URL' }
		]}
	/>
</section>
