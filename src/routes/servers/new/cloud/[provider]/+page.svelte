<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { cloudProviderLabel } from '$lib/cloud-security-presenter';
	import type { ProviderOptions } from '$lib/server/provider-provisioning';

	let { data, form } = $props();
	let ready = $state(false);
	let name = $state('');
	onMount(() => (ready = true));
	const label = $derived(cloudProviderLabel(data.provider));
	const result = $derived(
		form as {
			error?: string;
			provider?: string;
			values?: Record<string, unknown>;
			options?: ProviderOptions;
		} | null
	);
	const selectedToken = $derived(String(result?.values?.cloudProviderTokenUuid ?? ''));
	const options = $derived(result?.options);
	const confirmation = $derived(`PROVISION ${label.toUpperCase()} ${name.trim().toLowerCase()}`);
</script>

<svelte:head><title>Provision {label} server - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Provision with {label}</h1>
		<p class="muted">Create a provider instance and register it as a Coolify server.</p>
	</div>
	<a href={resolve('/servers/new')}>Other server methods</a>
</div>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if result?.error}<p class="error" role="alert">{result.error}</p>{/if}

<section class="settings-section">
	<h2>1. Provider account</h2>
	<form method="POST" action="?/loadOptions">
		<label
			>{label} token<select
				name="cloud_provider_token_uuid"
				required
				disabled={!ready || data.tokens.length === 0}
			>
				<option value="">Select a token</option>
				{#each data.tokens as token (token.uuid)}
					<option value={token.uuid} selected={selectedToken === token.uuid}>{token.name}</option>
				{/each}
			</select></label
		>
		<div class="actions">
			<button disabled={!ready || data.tokens.length === 0}>Load provider options</button>
			<a href={resolve('/security/cloud-tokens/new')}>Create cloud token</a>
		</div>
	</form>
	{#if data.tokens.length === 0}<p>No {label} tokens are available for this team.</p>{/if}
</section>

{#if options}
	<section class="settings-section">
		<h2>2. Server configuration</h2>
		<form method="POST" action="?/provision">
			<input type="hidden" name="cloud_provider_token_uuid" value={selectedToken} />
			<div class="form-grid">
				<label
					>Hostname<input
						name="name"
						bind:value={name}
						maxlength="253"
						pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*"
						required
						disabled={!ready}
					/></label
				>
				<label
					>Private key<select
						name="private_key_uuid"
						required
						disabled={!ready || data.keys.length === 0}
					>
						<option value="">Select a private key</option>
						{#each data.keys as key (key.uuid)}
							<option value={key.uuid}>{key.name}</option>
						{/each}
					</select></label
				>
				<label
					>Region<select name="region" required disabled={!ready}>
						<option value="">Select a region</option>
						{#each options.regions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select></label
				>
				<label
					>Server size<select name="size" required disabled={!ready}>
						<option value="">Select a size</option>
						{#each options.sizes as option (option.value)}
							<option value={option.value}
								>{option.label}{option.description ? ` — ${option.description}` : ''}</option
							>
						{/each}
					</select></label
				>
				<label
					>Operating system image<select name="image" required disabled={!ready}>
						<option value="">Select an image</option>
						{#each options.images as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select></label
				>
				<label
					>Reusable cloud-init script<select name="cloud_init_script_uuid" disabled={!ready}>
						<option value="">None</option>
						{#each data.scripts as script (script.uuid)}
							<option value={script.uuid}>{script.name}</option>
						{/each}
					</select></label
				>
				{#if options.sshKeys.length}
					<label
						>Extra provider SSH keys<select name="ssh_key_ids" multiple size="4" disabled={!ready}>
							{#each options.sshKeys as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select></label
					>
				{/if}
				{#if data.provider === 'hetzner' && options.firewalls.length}
					<label
						>Firewalls<select name="firewall_ids" multiple size="4" disabled={!ready}>
							{#each options.firewalls as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select></label
					>
				{/if}
				{#if data.provider === 'hetzner' && options.networks.length}
					<label
						>Private networks<select name="network_ids" multiple size="4" disabled={!ready}>
							{#each options.networks as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select></label
					>
				{/if}
			</div>

			<fieldset>
				<legend>Provider options</legend>
				{#if data.provider === 'hetzner'}
					<label class="checkbox-field"
						><input type="hidden" name="enable_ipv4" value="false" /><input
							type="checkbox"
							name="enable_ipv4"
							value="true"
							checked
							disabled={!ready}
						/> Enable IPv4</label
					>
				{/if}
				<label class="checkbox-field"
					><input type="hidden" name="enable_ipv6" value="false" /><input
						type="checkbox"
						name="enable_ipv6"
						value="true"
						checked
						disabled={!ready}
					/> Enable IPv6</label
				>
				{#if data.provider === 'digitalocean'}
					<label class="checkbox-field"
						><input type="hidden" name="monitoring" value="false" /><input
							type="checkbox"
							name="monitoring"
							value="true"
							checked
							disabled={!ready}
						/> Enable DigitalOcean monitoring</label
					>
				{/if}
				{#if data.provider === 'hetzner'}
					<label class="checkbox-field"
						><input type="hidden" name="enable_backups" value="false" /><input
							type="checkbox"
							name="enable_backups"
							value="true"
							disabled={!ready}
						/> Enable Hetzner backups (adds 20% to the server fee)</label
					>
				{/if}
				{#if data.provider === 'vultr'}
					<label class="checkbox-field"
						><input type="hidden" name="disable_public_ipv4" value="false" /><input
							type="checkbox"
							name="disable_public_ipv4"
							value="true"
							disabled={!ready}
						/> Disable public IPv4</label
					>
				{/if}
				<label class="checkbox-field"
					><input type="hidden" name="instant_validate" value="false" /><input
						type="checkbox"
						name="instant_validate"
						value="true"
						disabled={!ready}
					/> Queue Coolify validation after creation</label
				>
			</fieldset>

			<div class="danger-zone">
				<h2>3. Confirm billable provisioning</h2>
				<p class="error">
					This creates billable infrastructure in your {label} account. Warmify will send the request
					exactly once.
				</p>
				<label
					>Type <strong>{confirmation}</strong> exactly<input
						name="confirmation"
						required
						autocomplete="off"
						disabled={!ready || !name.trim()}
					/></label
				>
				<button class="danger" disabled={!ready || !name.trim() || data.keys.length === 0}
					>Provision {label} server</button
				>
			</div>
		</form>
	</section>
{/if}
