<script lang="ts">
	import { resolve } from '$app/paths';
	import HierarchyForm from './HierarchyForm.svelte';
	import type { ComponentProps, Snippet } from 'svelte';
	import type { loadHierarchyPage } from '$lib/server/project-actions';
	let {
		data,
		form,
		children
	}: {
		data: Awaited<ReturnType<typeof loadHierarchyPage>>;
		form?: ComponentProps<typeof HierarchyForm>['form'];
		children?: Snippet;
	} = $props();
</script>

<svelte:head
	><title
		>{data.name}
		{data.section === 'danger'
			? 'danger zone'
			: data.section === 'shared-variables'
				? 'shared variables'
				: 'settings'} - Warmify</title
	></svelte:head
>
<header class="page-header">
	<div>
		<h1>{data.name}</h1>
		<p class="muted">
			{data.kind === 'project' ? 'Project settings' : `Environment in ${data.projectName}`}
		</p>
	</div>
</header>
<nav class="actions hierarchy-nav" aria-label="Hierarchy settings">
	<a href={resolve(data.href)}>Back to {data.kind === 'project' ? 'environments' : 'resources'}</a>
	<a
		href={resolve(`${data.href}/settings`)}
		aria-current={data.section === 'settings' ? 'page' : undefined}>Settings</a
	>
	<a
		href={resolve(`${data.href}/danger`)}
		aria-current={data.section === 'danger' ? 'page' : undefined}>Danger zone</a
	>
	<a
		href={resolve(`${data.href}/shared-variables`)}
		aria-current={data.section === 'shared-variables' ? 'page' : undefined}>Shared variables</a
	>
</nav>
{#key `${data.href}/${data.section}`}
	<section class="settings-section">
		{#if data.section === 'settings'}
			<h2>General</h2>
			<HierarchyForm
				action="?/save"
				label="Save settings"
				name={data.name}
				description={data.description}
				{form}
			/>
		{:else if data.section === 'danger'}
			<h2>Delete {data.kind}</h2>
			<p class="error">
				Deletion is permanent. Coolify refuses to delete a {data.kind} that still contains resources.
				Remove or move those resources separately first.
			</p>
			{#if data.kind === 'project'}<p>
					All empty environments, project settings and project shared variables will also be
					removed.
				</p>
			{:else}<p>This environment and its shared variables will be removed.</p>{/if}
			{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
			<form method="POST" action="?/delete">
				<label
					>Type {data.name} or {data.uuid} to confirm<input
						name="confirmation"
						autocomplete="off"
						required
					/></label
				>
				<button class="danger" type="submit">Delete {data.kind} permanently</button>
			</form>
		{:else}
			{@render children?.()}
		{/if}
	</section>
{/key}

<style>
	.hierarchy-nav a {
		color: var(--muted);
		text-decoration: none;
	}
	.hierarchy-nav a:hover,
	.hierarchy-nav a:focus-visible {
		text-decoration: underline;
	}
	.hierarchy-nav a[aria-current='page'] {
		color: var(--link);
		text-decoration: underline;
	}
</style>
