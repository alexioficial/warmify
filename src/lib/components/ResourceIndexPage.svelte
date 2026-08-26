<script lang="ts">
	import { resolve } from '$app/paths';
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import { versionLabel } from '$lib/resource-presenter';

	let {
		data,
		form
	}: {
		data: {
			title: string;
			group: string;
			data: unknown;
			detailPath?: string;
			requestError?: string;
		};
		form?: { error?: string; message?: string; name?: string } | null;
	} = $props();
</script>

<svelte:head><title>{data.title} - Warmify</title></svelte:head>

<p><a href={resolve('/')}>Dashboard</a> /</p>
<div class="section-heading"><h1>{data.title}</h1></div>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

{#if data.group === 'projects'}
	<details>
		<summary>Create project</summary>
		<form method="POST" action="?/createProject">
			<label>Name <input name="name" value={form?.name ?? ''} required /></label>
			<label>Description <textarea name="description"></textarea></label>
			<button type="submit">Create project</button>
		</form>
	</details>
{/if}

{#if data.group === 'deployments'}
	<DeploymentTable data={data.data} />
{:else if data.group === 'system'}
	<dl class="overview">
		<dt>Coolify version</dt>
		<dd>{versionLabel(data.data)}</dd>
	</dl>
	<h2>API access</h2>
	<form class="actions" method="POST" action="?/systemAction">
		<button name="action" value="enable">Enable API</button>
		<button name="action" value="mcp-enable">Enable MCP</button>
		<button name="action" value="mcp-disable">Disable MCP</button>
	</form>
	<details>
		<summary class="danger">Disable Coolify API</summary>
		<p class="danger">
			Warmify will immediately lose access. You will need to re-enable the API from Coolify itself.
		</p>
		<form method="POST" action="?/systemAction">
			<input type="hidden" name="action" value="disable" />
			<label
				><input type="checkbox" name="confirmation" value="confirm" required /> I understand that Warmify
				will lose access.</label
			>
			<button type="submit">Disable API</button>
		</form>
	</details>
{:else}
	<DataTable data={data.data} detailGroup={data.detailPath ? data.group : undefined} />
{/if}
