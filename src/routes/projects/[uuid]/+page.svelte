<script lang="ts">
	import { resolve } from '$app/paths';
	import { firstText, normalizeRecords } from '$lib/resource-presenter';
	import { SvelteMap } from 'svelte/reactivity';
	import CollectionSynchronizer from '$lib/components/CollectionSynchronizer.svelte';
	import HierarchyForm from '$lib/components/HierarchyForm.svelte';

	let { data, form } = $props();
	let search = $state('');
	let environmentData = $derived(data.environments);
	const environments = $derived(
		normalizeRecords(environmentData).filter((environment) =>
			firstText(environment, ['name']).toLowerCase().includes(search.trim().toLowerCase())
		)
	);

	function applyResourceCounts(value: unknown) {
		const counts = new SvelteMap<string, number>();
		for (const resource of normalizeRecords(value)) {
			const environmentId = firstText(resource, ['environment_id']);
			if (environmentId) counts.set(environmentId, (counts.get(environmentId) ?? 0) + 1);
		}
		environmentData = normalizeRecords(environmentData).map((environment) => ({
			...environment,
			resources_count: counts.get(firstText(environment, ['id'])) ?? 0
		}));
	}
</script>

<header class="page-header">
	<div>
		<h1>{data.projectName}</h1>
		<p class="muted">
			{environments.length}
			{environments.length === 1 ? 'environment' : 'environments'} in this project
		</p>
	</div>
	<div class="actions">
		<a href={resolve(`/projects/${encodeURIComponent(data.projectUuid)}/settings`)}>Settings</a>
		{#key data.projectUuid}
			<details {...form?.error ? { open: true } : {}}>
				<summary class="button primary">New environment</summary>
				<HierarchyForm action="?/createEnvironment" label="Create environment" nameOnly {form} />
			</details>
		{/key}
	</div>
</header>

<CollectionSynchronizer
	url="/internal/poll/collections/resources"
	initialUpdatedAt={data.sync?.updatedAt}
	initialStale={data.sync?.stale}
	onValue={applyResourceCounts}
/>

<div class="page-toolbar">
	<label class="visually-hidden" for="environment-search">Search environments</label>
	<input
		id="environment-search"
		type="search"
		placeholder="Search environments"
		bind:value={search}
	/>
</div>

{#if environments.length}
	<div class="environment-grid">
		{#each environments as environment (firstText(environment, ['uuid', 'id']))}
			{@const environmentUuid = firstText(environment, ['uuid', 'name', 'id'])}
			{@const count = Number(firstText(environment, ['resources_count'])) || 0}
			<a
				class="environment-item"
				href={resolve('/projects/[uuid]/environments/[environment]', {
					uuid: data.projectUuid,
					environment: environmentUuid
				})}
			>
				<div>
					<strong class="environment-title"
						>{firstText(environment, ['name']) || 'Environment'}</strong
					>
					<p class="muted">{firstText(environment, ['description']) || 'Environment'}</p>
				</div>
				<span>{count} {count === 1 ? 'resource' : 'resources'}</span>
			</a>
		{/each}
	</div>
{:else}
	<p>No environments found.</p>
{/if}
