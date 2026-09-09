<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import ServerSecretReveal from '$lib/components/ServerSecretReveal.svelte';
	let { data } = $props();
	let ready = $state(false);
	let newRelicKeyMode = $state('keep');
	let axiomKeyMode = $state('keep');
	let customConfigMode = $state('keep');
	let customParserMode = $state('keep');
	onMount(() => (ready = true));
</script>

<h2>Log drains</h2>
<p class="muted">
	Forward container logs through New Relic, Axiom or a custom Fluent Bit configuration. Saving
	starts or stops the log drain service as needed.
</p>
{#if data.requestError}<p role="alert" class="error">{data.requestError}</p>{/if}
<form method="POST" action="?/update" use:enhance>
	<fieldset disabled={!ready || !!data.requestError}>
		<legend>New Relic</legend>
		<input type="hidden" name="is_logdrain_newrelic_enabled" value="false" />
		<label class="checkbox-field"
			><input
				type="checkbox"
				name="is_logdrain_newrelic_enabled"
				value="true"
				checked={data.drains.newRelicEnabled}
			/>Enable New Relic</label
		>
		<label
			>Base URI<input
				type="url"
				name="logdrain_newrelic_base_uri"
				value={data.drains.newRelicBaseUri}
				placeholder="https://log-api.newrelic.com"
			/></label
		>
		<label
			>License key<select name="logdrain_newrelic_license_key_mode" bind:value={newRelicKeyMode}
				><option value="keep">Keep existing key</option><option value="replace">Replace key</option
				><option value="clear">Clear key</option></select
			></label
		>
		{#if newRelicKeyMode === 'replace'}
			<label
				>Replacement license key<input
					type="password"
					name="logdrain_newrelic_license_key"
					autocomplete="new-password"
					required
				/></label
			>
		{/if}
	</fieldset>

	<fieldset disabled={!ready || !!data.requestError}>
		<legend>Axiom</legend>
		<input type="hidden" name="is_logdrain_axiom_enabled" value="false" />
		<label class="checkbox-field"
			><input
				type="checkbox"
				name="is_logdrain_axiom_enabled"
				value="true"
				checked={data.drains.axiomEnabled}
			/>Enable Axiom</label
		>
		<label
			>Dataset<input name="logdrain_axiom_dataset_name" value={data.drains.axiomDataset} /></label
		>
		<label
			>API key<select name="logdrain_axiom_api_key_mode" bind:value={axiomKeyMode}
				><option value="keep">Keep existing key</option><option value="replace">Replace key</option
				><option value="clear">Clear key</option></select
			></label
		>
		{#if axiomKeyMode === 'replace'}
			<label
				>Replacement API key<input
					type="password"
					name="logdrain_axiom_api_key"
					autocomplete="new-password"
					required
				/></label
			>
		{/if}
	</fieldset>

	<fieldset disabled={!ready || !!data.requestError}>
		<legend>Custom Fluent Bit configuration</legend>
		<input type="hidden" name="is_logdrain_custom_enabled" value="false" />
		<label class="checkbox-field"
			><input
				type="checkbox"
				name="is_logdrain_custom_enabled"
				value="true"
				checked={data.drains.customEnabled}
			/>Enable custom log drain</label
		>
		<label
			>Configuration<select name="logdrain_custom_config_mode" bind:value={customConfigMode}
				><option value="keep">Keep existing configuration</option><option value="replace"
					>Replace configuration</option
				><option value="clear">Clear configuration</option></select
			></label
		>
		{#if customConfigMode === 'replace'}
			<label
				>Replacement configuration<textarea name="logdrain_custom_config" rows="12" required
				></textarea></label
			>
		{/if}
		<label
			>Parser configuration<select
				name="logdrain_custom_config_parser_mode"
				bind:value={customParserMode}
				><option value="keep">Keep existing parser</option><option value="replace"
					>Replace parser</option
				><option value="clear">Clear parser</option></select
			></label
		>
		{#if customParserMode === 'replace'}
			<label
				>Replacement parser<textarea name="logdrain_custom_config_parser" rows="8" required
				></textarea></label
			>
		{/if}
	</fieldset>
	<label
		>Type <strong>SAVE LOG DRAINS</strong> to confirm<input
			name="confirmation"
			required
			autocomplete="off"
			disabled={!ready}
		/></label
	>
	<button class="primary" disabled={!ready || !!data.requestError}>Save log drains</button>
</form>

<section class="settings-section">
	<h3>Stored secrets and custom configuration</h3>
	<p class="muted">These values are requested only after an explicit sensitive read.</p>
	<ServerSecretReveal
		url={`/servers/${encodeURIComponent(data.uuid)}/log-drains/reveal`}
		fields={[
			{ key: 'newRelicLicenseKey', label: 'New Relic license key' },
			{ key: 'axiomApiKey', label: 'Axiom API key' },
			{ key: 'customConfig', label: 'Custom configuration' },
			{ key: 'customParser', label: 'Custom parser' }
		]}
	/>
</section>
