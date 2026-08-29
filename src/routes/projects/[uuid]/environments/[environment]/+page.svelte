<script lang="ts">
	import { resolve } from '$app/paths';
	import { environmentResources } from '$lib/resource-presenter';
	import { detailPath } from '$lib/resource-routes';

	let { data } = $props();
	let search = $state('');
	const resources = $derived(
		environmentResources(data.environment).filter((resource) =>
			[resource.name, resource.type, resource.description]
				.join(' ')
				.toLowerCase()
				.includes(search.trim().toLowerCase())
		)
	);
	function statusClass(status: string) {
		return `status status-${status.toLowerCase().split(/[ -]/)[0]}`;
	}

	function resourceHref(group: string, id: string) {
		return resolve(detailPath(group, id) ?? '/');
	}
</script>

<header class="page-header">
	<div>
		<h1>{data.environmentName}</h1>
		<p class="muted">
			{resources.length}
			{resources.length === 1 ? 'resource' : 'resources'} in {data.projectName}
		</p>
	</div>
	<a
		class="button primary"
		href={resolve('/projects/[uuid]/environments/[environment]/new', {
			uuid: data.projectUuid,
			environment: data.environmentUuid
		})}>New resource</a
	>
</header>

<div class="page-toolbar">
	<label class="visually-hidden" for="resource-search">Search resources</label>
	<input id="resource-search" type="search" placeholder="Search resources" bind:value={search} />
</div>

{#if resources.length}
	<div class="table-wrap">
		<table class="resource-table">
			<thead>
				<tr><th>Resource</th><th>Type</th><th>Status</th><th>Details</th></tr>
			</thead>
			<tbody>
				{#each resources as resource (`${resource.group}:${resource.id}`)}
					<tr>
						<td>
							<a href={resourceHref(resource.group, resource.id)}>{resource.name}</a>
						</td>
						<td>{resource.type}</td>
						<td><span class={statusClass(resource.status)}>{resource.status}</span></td>
						<td>{resource.description || resource.context || '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<div class="empty-state">
		<p>No resources in this environment.</p>
		<a
			href={resolve('/projects/[uuid]/environments/[environment]/new', {
				uuid: data.projectUuid,
				environment: data.environmentUuid
			})}>Add the first resource</a
		>
	</div>
{/if}
