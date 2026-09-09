<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	type ServerDraft = {
		name?: string;
		description?: string;
		ip?: string;
		port?: number;
		user?: string;
		privateKeyUuid?: string;
		proxyType?: string;
		isBuildServer?: boolean;
		instantValidate?: boolean;
	};
	const values = $derived((form?.values ?? {}) as ServerDraft);
</script>

<svelte:head><title>New server - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New server</h1>
		<p class="muted">Connect an existing server to Coolify over SSH.</p>
	</div>
	<a href={resolve('/servers')}>All servers</a>
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

<section class="settings-section">
	<h2>Provision with a cloud provider</h2>
	<p class="muted">Create billable infrastructure through a validated provider token.</p>
	<div class="actions">
		<a class="button" href={resolve('/servers/new/cloud/hetzner')}>Hetzner</a>
		<a class="button" href={resolve('/servers/new/cloud/digitalocean')}>DigitalOcean</a>
		<a class="button" href={resolve('/servers/new/cloud/vultr')}>Vultr</a>
	</div>
</section>

<section class="settings-section">
	<h2>Connection</h2>
	<form method="POST" action="?/createServer">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					value={values.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>IP address or hostname<input
					name="ip"
					required
					maxlength="253"
					placeholder="server.example.com"
					value={values.ip ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>SSH port<input
					name="port"
					type="number"
					min="1"
					max="65535"
					required
					value={values.port ?? 22}
					disabled={!ready}
				/></label
			>
			<label
				>SSH user<input
					name="user"
					required
					value={values.user ?? 'root'}
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
						<option value={key.uuid} selected={values.privateKeyUuid === key.uuid}>
							{key.name}{key.description ? ` — ${key.description}` : ''}
						</option>
					{/each}
				</select></label
			>
			<label
				>Proxy<select name="proxy_type" disabled={!ready}>
					{#each [{ value: 'traefik', label: 'Traefik' }, { value: 'caddy', label: 'Caddy' }, { value: 'none', label: 'None' }] as option (option.value)}
						<option value={option.value} selected={(values.proxyType ?? 'traefik') === option.value}
							>{option.label}</option
						>
					{/each}
				</select></label
			>
		</div>
		<label
			>Description<textarea name="description" rows="3" disabled={!ready}
				>{values.description ?? ''}</textarea
			></label
		>
		<fieldset>
			<legend>Advanced</legend>
			<label class="checkbox-field">
				<input type="hidden" name="is_build_server" value="false" />
				<input
					type="checkbox"
					name="is_build_server"
					value="true"
					checked={values.isBuildServer ?? false}
					disabled={!ready}
				/>
				Use this server for builds
			</label>
			<label class="checkbox-field">
				<input type="hidden" name="instant_validate" value="false" />
				<input
					type="checkbox"
					name="instant_validate"
					value="true"
					checked={values.instantValidate ?? false}
					disabled={!ready}
				/>
				Queue validation after creation
			</label>
			<p class="muted">Validation runs asynchronously in Coolify after the server is created.</p>
		</fieldset>
		<div class="actions">
			<button class="primary" disabled={!ready || data.keys.length === 0}>Create server</button>
			<a href={resolve('/security/keys')}>Manage private keys</a>
		</div>
	</form>
</section>
