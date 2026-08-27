<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const applicationTypes = [
		{
			id: 'public-repository',
			name: 'Public Git Repository',
			category: 'Git source',
			description: 'Deploy any public Git repository. Coolify builds it from source.'
		},
		{
			id: 'private-deploy-key',
			name: 'Private Git Repository (with Deploy Key)',
			category: 'Git source',
			description: 'Deploy a private repository over SSH with an existing private key.'
		},
		{
			id: 'github-app',
			name: 'Git Repository (with GitHub App)',
			category: 'Git source',
			description: 'Deploy a repository through one of the GitHub Apps connected to Coolify.'
		},
		{
			id: 'gitlab-app',
			name: 'Git Repository (with GitLab App)',
			category: 'Git source',
			description: 'Coolify does not currently publish an API endpoint for creating this resource.'
		},
		{
			id: 'dockerfile',
			name: 'Dockerfile',
			category: 'Docker source',
			description: 'Create an application directly from Dockerfile content, without a Git repository.'
		},
		{
			id: 'docker-compose',
			name: 'Docker Compose',
			category: 'Docker source',
			description: 'Create a multi-container service from a Docker Compose definition.'
		},
		{
			id: 'docker-image',
			name: 'Docker Image',
			category: 'Docker source',
			description: 'Deploy a prebuilt image from Docker Hub or another OCI registry.'
		}
	];
	const databases = [
		['postgresql', 'PostgreSQL', 'Relational database with strong SQL standards support.'],
		['mysql', 'MySQL', 'Relational database for web and general-purpose applications.'],
		['mariadb', 'MariaDB', 'Relational database and drop-in replacement for MySQL.'],
		['redis', 'Redis', 'In-memory key-value database, cache, and message broker.'],
		['keydb', 'KeyDB', 'Multithreaded Redis-compatible in-memory store.'],
		['dragonfly', 'Dragonfly', 'In-memory datastore compatible with Redis and Memcached.'],
		['mongodb', 'MongoDB', 'Document-oriented database that stores JSON-like documents.'],
		['clickhouse', 'ClickHouse', 'Column-oriented database for real-time analytics.']
	];

	function configurationPath(kind: string) {
		return resolve('/projects/[uuid]/environments/[environment]/new/[kind]', {
			uuid: data.projectUuid,
			environment: data.environmentUuid,
			kind
		});
	}
</script>

<header class="page-header">
	<div>
		<h1>New resource</h1>
		<p class="muted">Choose what to add to {data.environmentName}.</p>
	</div>
</header>

<section aria-labelledby="applications-heading">
	<h2 id="applications-heading">Applications and services</h2>
	<div class="resource-choice-grid">
		{#each applicationTypes as type (type.id)}
			<a class="resource-choice" href={configurationPath(type.id)}>
				<div>
					<h3>{type.name}</h3>
					<p class="muted">{type.category}</p>
				</div>
				<p>{type.description}</p>
				<span class="choice-action">Configure</span>
			</a>
		{/each}
	</div>
</section>

<section class="new-resource-section" aria-labelledby="databases-heading">
	<h2 id="databases-heading">Databases</h2>
	<div class="resource-choice-grid">
		{#each databases as database (database[0])}
			<a class="resource-choice" href={configurationPath(database[0])}>
				<h3>{database[1]}</h3>
				<p>{database[2]}</p>
				<span class="choice-action">Configure</span>
			</a>
		{/each}
	</div>
</section>
