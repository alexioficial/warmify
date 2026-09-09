<script lang="ts">
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>System - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>System</h1>
		<p class="muted">Coolify health, version, API access, and MCP endpoint controls.</p>
	</div>
</div>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

<section class="settings-section">
	<h2>Instance status</h2>
	<dl class="detail-list">
		<div>
			<dt>Health endpoint</dt>
			<dd>{data.health}</dd>
		</div>
		<div>
			<dt>Version</dt>
			<dd>{data.version}</dd>
		</div>
		<div>
			<dt>Protected API</dt>
			<dd>{data.apiAvailable ? 'Reachable' : 'Unavailable'}</dd>
		</div>
		<div>
			<dt>Token team</dt>
			<dd>{data.teamName || 'Unavailable'}</dd>
		</div>
		<div>
			<dt>Root permission</dt>
			<dd>
				{data.rootTeam === true
					? 'Available'
					: data.rootTeam === false
						? 'Not available'
						: 'Unknown while API reads are unavailable'}
			</dd>
		</div>
	</dl>
</section>

<section class="settings-section">
	<h2>Coolify API</h2>
	<p class="muted">
		The public API does not expose the current enabled flag. Warmify can only verify whether
		protected reads respond.
	</p>
	<div class="form-grid">
		<form method="POST" action="?/enableApi">
			<h3>Enable API</h3>
			<p>
				Use this recovery action when Coolify is healthy but protected API reads are unavailable.
			</p>
			<label
				>Type ENABLE API to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready || data.rootTeam === false}
				/></label
			>
			<button class="primary" disabled={!ready || data.rootTeam === false}>Enable API</button>
		</form>
		<form method="POST" action="?/disableApi">
			<h3>Disable API</h3>
			<p class="danger">
				Warmify depends on this API. Disabling it immediately prevents every resource page and
				mutation from working until `/enable` is called again externally or through this recovery
				page.
			</p>
			<label
				>Type DISABLE API to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready || data.rootTeam !== true}
				/></label
			>
			<button class="danger" disabled={!ready || data.rootTeam !== true}>Disable API</button>
		</form>
	</div>
</section>

<section class="settings-section">
	<h2>MCP server</h2>
	<p class="muted">
		The public API supports enabling and disabling the `/mcp` endpoint but does not expose its
		current state. Both actions require a root-team token.
	</p>
	<div class="form-grid">
		<form method="POST" action="?/enableMcp">
			<label
				>Type ENABLE MCP to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready || data.rootTeam !== true}
				/></label
			>
			<button class="primary" disabled={!ready || data.rootTeam !== true}>Enable MCP</button>
		</form>
		<form method="POST" action="?/disableMcp">
			<label
				>Type DISABLE MCP to confirm<input
					name="confirmation"
					autocomplete="off"
					required
					disabled={!ready || data.rootTeam !== true}
				/></label
			>
			<button class="danger" disabled={!ready || data.rootTeam !== true}>Disable MCP</button>
		</form>
	</div>
</section>
