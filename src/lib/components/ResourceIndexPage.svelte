<script lang="ts">
	import { onMount } from 'svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
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
	let refreshed = $state<{ value: unknown }>();
	const content = $derived(refreshed ? refreshed.value : data.data);

	onMount(() => {
		void fetch(`/internal/poll/collections/${encodeURIComponent(data.group)}`)
			.then((response) => {
				if (!response.ok) throw new Error('Collection synchronization failed');
				return response.json();
			})
			.then((value) => {
				refreshed = { value };
			})
			.catch(() => undefined);
	});
</script>

<svelte:head><title>{data.title} - Warmify</title></svelte:head>

<div class="page-header">
	<div>
		<h1>{data.title}</h1>
		<p class="muted">
			{#if data.group === 'projects'}Your deployment workspaces
			{:else if data.group === 'servers'}Infrastructure available for deployments
			{:else if data.group === 'sources'}Git sources connected to your team
			{:else if data.group === 'deployments'}Deployment activity
			{:else}Manage {data.title.toLowerCase()}{/if}
		</p>
	</div>
	{#if data.group === 'projects'}
		<details>
			<summary class="button primary">New project</summary>
			<form method="POST" action="?/createProject">
				<label>Name <input name="name" value={form?.name ?? ''} required /></label>
				<label>Description <textarea name="description"></textarea></label>
				<button class="primary" type="submit">Create project</button>
			</form>
		</details>
	{/if}
</div>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

{#if data.group === 'projects'}
	<ProjectGrid data={content} searchable />
{:else if data.group === 'deployments'}
	<DeploymentTable data={content} />
{:else if data.group === 'system'}
	<dl class="overview">
		<dt>Coolify version</dt>
		<dd>{versionLabel(content)}</dd>
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
	<DataTable
		data={content}
		detailGroup={data.detailPath ? data.group : undefined}
		displayGroup={data.group}
		searchable
	/>
{/if}
