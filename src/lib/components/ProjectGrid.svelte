<script lang="ts">
	import { resolve } from '$app/paths';
	import { normalizeRecords, projectStats, resourceSummary } from '$lib/resource-presenter';
	import { detailPath } from '$lib/resource-routes';

	let { data, searchable = false }: { data: unknown; searchable?: boolean } = $props();
	let query = $state('');
	const projects = $derived(
		normalizeRecords(data).map((record) => ({
			record,
			summary: resourceSummary(record, 'projects'),
			stats: projectStats(record)
		}))
	);
	const visibleProjects = $derived(
		projects.filter((project) =>
			`${project.summary.name} ${project.summary.description}`
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
</script>

{#if searchable}
	<div class="page-toolbar">
		<label class="visually-hidden" for="project-search">Search projects</label>
		<input id="project-search" type="search" placeholder="Search projects" bind:value={query} />
		<span class="muted">{visibleProjects.length} projects</span>
	</div>
{/if}

{#if visibleProjects.length}
	<div class="project-grid">
		{#each visibleProjects as project, index (project.summary.id || index)}
			<article class="project-item">
				<div>
					<a href={resolve(detailPath('projects', project.summary.id) ?? '/projects')}
						>{project.summary.name}</a
					>
					<p class="muted">{project.summary.description || 'No description'}</p>
				</div>
				<div class="project-stats">
					<span>{project.stats.environments} env</span>
					<span>·</span>
					<span
						>{project.stats.resources}
						{project.stats.resources === 1 ? 'resource' : 'resources'}</span
					>
				</div>
			</article>
		{/each}
	</div>
{:else}
	<p class="muted">No projects found.</p>
{/if}
