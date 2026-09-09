<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const values = $derived((form?.values ?? {}) as Record<string, string | number | boolean>);
	const github = $derived(data.provider === 'github');
</script>

<svelte:head><title>New {github ? 'GitHub' : 'GitLab'} App - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>New {github ? 'GitHub' : 'GitLab'} App</h1>
		<p class="muted">Connect a provider configuration registered for this Coolify instance.</p>
	</div>
	<a href={resolve('/sources')}>All sources</a>
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

<section class="settings-section">
	<h2>Provider settings</h2>
	<form method="POST" action="?/create">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					required
					value={values.name ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Provider URL<input
					name="html_url"
					type="url"
					required
					placeholder={github ? 'https://github.com' : 'https://gitlab.com'}
					value={values.htmlUrl ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>API URL<input
					name="api_url"
					type="url"
					placeholder={github ? 'https://api.github.com' : 'https://gitlab.com/api/v4'}
					value={values.apiUrl ?? ''}
					disabled={!ready}
				/></label
			>
			<label
				>Git SSH user<input
					name="custom_user"
					value={values.customUser ?? 'git'}
					disabled={!ready}
				/></label
			>
			<label
				>Git SSH port<input
					name="custom_port"
					type="number"
					min="1"
					max="65535"
					required
					value={values.customPort ?? 22}
					disabled={!ready}
				/></label
			>
			{#if github}
				<label
					>Organization<input
						name="organization"
						maxlength="255"
						value={values.organization ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>GitHub App ID<input
						name="app_id"
						type="number"
						min="1"
						required
						value={values.appId ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>Installation ID<input
						name="installation_id"
						type="number"
						min="1"
						required
						value={values.installationId ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>Client ID<input
						name="client_id"
						required
						value={values.clientId ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>Client secret<input
						name="client_secret"
						type="password"
						required
						autocomplete="new-password"
						disabled={!ready}
					/></label
				>
				<label
					>Webhook secret<input
						name="webhook_secret"
						type="password"
						required
						autocomplete="new-password"
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
							<option value={key.uuid} selected={values.privateKeyUuid === key.uuid}
								>{key.name}</option
							>
						{/each}
					</select></label
				>
			{:else}
				<label
					>Group name<input
						name="group_name"
						maxlength="255"
						value={values.groupName ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>OAuth application ID<input
						name="client_id"
						value={values.clientId ?? ''}
						disabled={!ready}
					/></label
				>
				<label
					>OAuth client secret<input
						name="client_secret"
						type="password"
						autocomplete="new-password"
						disabled={!ready}
					/></label
				>
				<label
					>Webhook token<input
						name="webhook_token"
						type="password"
						autocomplete="new-password"
						disabled={!ready}
					/></label
				>
				<label class="wide"
					>OAuth redirect URI<input
						name="redirect_uri"
						type="url"
						value={values.redirectUri ?? ''}
						disabled={!ready}
					/></label
				>
			{/if}
		</div>
		<label class="checkbox-field">
			<input type="hidden" name="is_system_wide" value="false" />
			<input
				type="checkbox"
				name="is_system_wide"
				value="true"
				checked={values.isSystemWide === true}
				disabled={!ready}
			/>
			Share this source across the instance
		</label>
		<p class="muted">
			Credentials are sent once to Coolify and are never stored in Warmify's cache.
		</p>
		<div class="actions">
			<button class="primary" disabled={!ready || (github && data.keys.length === 0)}
				>Create source</button
			>
			{#if github}<a href={resolve('/security/keys')}>Manage private keys</a>{/if}
		</div>
	</form>
</section>
