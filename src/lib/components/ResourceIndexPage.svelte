<script lang="ts">
	import { resolve } from '$app/paths';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import ProjectGrid from '$lib/components/ProjectGrid.svelte';
	import HierarchyForm from '$lib/components/HierarchyForm.svelte';

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
			sync?: { updatedAt: number; fromCache: boolean; stale: boolean } | null;
		};
		form?: {
			error?: string;
			message?: string;
			name?: string;
			values?: { name?: string; description?: string };
			fieldErrors?: Record<string, string>;
		} | null;
	} = $props();
	let refreshed = $state<{ value: unknown }>();
	const content = $derived(refreshed ? refreshed.value : data.data);
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
		<details {...form?.error ? { open: true } : {}}>
			<summary class="button primary">New project</summary>
			<p class="muted">A production environment is created automatically.</p>
			<HierarchyForm action="?/createProject" label="Create project" {form} />
		</details>
	{:else if data.group === 'servers'}
		<a class="button primary" href={resolve('/servers/new')}>New server</a>
	{/if}
</div>
<CollectionSynchronizer
	url={`/internal/poll/collections/${encodeURIComponent(data.group)}`}
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={(value) => (refreshed = { value })}
/>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if data.group !== 'projects'}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.message}<p role="status">{form.message}</p>{/if}
{/if}

{#if data.group === 'projects'}
	<ProjectGrid data={content} searchable />
{:else if data.group === 'deployments'}
	<DeploymentTable data={content} />
{:else}
	<DataTable
		data={content}
		detailGroup={data.detailPath ? data.group : undefined}
		displayGroup={data.group}
		searchable
	/>
{/if}
