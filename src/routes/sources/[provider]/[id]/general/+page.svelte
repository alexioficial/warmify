<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const github = $derived(data.provider === 'github');
	const selectedKey = $derived(
		data.keys.find((key: { id?: number }) => key.id === data.source.privateKeyId)?.uuid ?? ''
	);
</script>

<section class="settings-section">
	<h2>General</h2>
	<form method="POST" action="?/update">
		<div class="form-grid">
			<label
				>Name<input
					name="name"
					maxlength="255"
					required
					value={data.source.name}
					disabled={!ready || !data.source.owned}
				/></label
			>
			<label
				>Provider URL<input
					name="html_url"
					type="url"
					required
					value={data.source.htmlUrl}
					disabled={!ready || !data.source.owned}
				/></label
			>
			<label
				>API URL<input
					name="api_url"
					type="url"
					value={data.source.apiUrl}
					disabled={!ready || !data.source.owned}
				/></label
			>
			<label
				>Git SSH user<input
					name="custom_user"
					value={data.source.customUser}
					disabled={!ready || !data.source.owned}
				/></label
			>
			<label
				>Git SSH port<input
					name="custom_port"
					type="number"
					min="1"
					max="65535"
					required
					value={data.source.customPort}
					disabled={!ready || !data.source.owned}
				/></label
			>
			{#if github}
				<label
					>Organization<input
						name="organization"
						maxlength="255"
						value={data.source.organization}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>GitHub App ID<input
						name="app_id"
						type="number"
						min="1"
						required
						value={data.source.appId ?? ''}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Installation ID<input
						name="installation_id"
						type="number"
						min="1"
						required
						value={data.source.installationId ?? ''}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Client ID<input
						name="client_id"
						required
						value={data.source.clientId}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Replace client secret<input
						name="client_secret"
						type="password"
						autocomplete="new-password"
						placeholder="Leave blank to keep current"
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Replace webhook secret<input
						name="webhook_secret"
						type="password"
						autocomplete="new-password"
						placeholder="Leave blank to keep current"
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Private key<select name="private_key_uuid" disabled={!ready || !data.source.owned}>
						<option value="">Keep current private key</option>
						{#each data.keys as key (key.uuid)}
							<option value={key.uuid} selected={selectedKey === key.uuid}>{key.name}</option>
						{/each}
					</select></label
				>
			{:else}
				<label
					>Group name<input
						name="group_name"
						maxlength="255"
						value={data.source.groupName}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>OAuth application ID<input
						name="client_id"
						value={data.source.clientId}
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Replace OAuth client secret<input
						name="client_secret"
						type="password"
						autocomplete="new-password"
						placeholder="Leave blank to keep current"
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label
					>Replace webhook token<input
						name="webhook_token"
						type="password"
						autocomplete="new-password"
						placeholder="Leave blank to keep current"
						disabled={!ready || !data.source.owned}
					/></label
				>
				<label class="wide"
					>OAuth redirect URI<input
						name="redirect_uri"
						type="url"
						value={data.source.redirectUri}
						disabled={!ready || !data.source.owned}
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
				checked={data.source.isSystemWide}
				disabled={!ready || !data.source.owned}
			/>
			System-wide source
		</label>
		<p class="muted">
			Existing credentials are never retrieved. Enter a replacement only when rotating one.
		</p>
		{#if data.source.owned}<button class="primary" disabled={!ready}>Save source</button>{/if}
	</form>
</section>
