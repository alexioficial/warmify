<script lang="ts">
	import { resolve } from '$app/paths';
	import DatabaseCreationForm from '$lib/components/DatabaseCreationForm.svelte';
	import ResourceCreationForm from '$lib/components/ResourceCreationForm.svelte';
	import GitCreationForm from '$lib/components/GitCreationForm.svelte';
	let { data, form } = $props();
	const titles: Record<string, string> = {
		'public-repository': 'Public Git Repository',
		'private-deploy-key': 'Private Git Repository (with Deploy Key)',
		'github-app': 'Git Repository (with GitHub App)',
		'gitlab-app': 'Git Repository (with GitLab App)',
		dockerfile: 'Dockerfile',
		'docker-compose': 'Docker Compose',
		'docker-image': 'Docker Image',
		'service-template': 'Service template',
		postgresql: 'PostgreSQL',
		mysql: 'MySQL',
		mariadb: 'MariaDB',
		redis: 'Redis',
		keydb: 'KeyDB',
		dragonfly: 'Dragonfly',
		mongodb: 'MongoDB',
		clickhouse: 'ClickHouse'
	};
</script>

<header class="page-header">
	<div>
		<h1>{titles[data.kind] ?? 'New resource'}</h1>
		<p class="muted">Add this resource to {data.projectName} / {data.environmentName}.</p>
	</div>
	<a
		href={resolve('/projects/[uuid]/environments/[environment]/new', {
			uuid: data.projectUuid,
			environment: data.environmentUuid
		})}>Choose another type</a
	>
</header>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#key data.projectUuid + '/' + data.environmentUuid + '/' + data.kind + '/' + (data.discovery?.selectedGithubAppId ?? '') + '/' + (data.discovery?.selectedRepository ?? '')}
	{#if data.kind === 'gitlab-app'}
		<section class="settings-section">
			<h2>Unavailable through the public API</h2>
			<p>
				Coolify does not publish a GitLab App application-creation endpoint. Use a deploy key or a
				public repository instead.
			</p>
			<a href={resolve('/sources')}>Manage sources</a>
		</section>
	{:else if data.databaseCreationFields.length}
		<DatabaseCreationForm
			fields={data.databaseCreationFields}
			servers={data.servers}
			destinations={data.destinations}
			{form}
		/>
	{:else if data.dockerCreationFields.length}
		<ResourceCreationForm
			fields={data.dockerCreationFields}
			servers={data.servers}
			destinations={data.destinations}
			{form}
		/>
	{:else if data.templateCreationFields.length}
		<ResourceCreationForm
			fields={data.templateCreationFields}
			servers={data.servers}
			destinations={data.destinations}
			{form}
			notice="Coolify uses its installed template to generate containers, variables and defaults. Leave optional fields blank to retain those defaults."
		/>
	{:else}
		<GitCreationForm
			kind={data.kind}
			servers={data.servers}
			destinations={data.destinations}
			privateKeys={data.privateKeys}
			discovery={data.discovery}
			{form}
		/>
	{/if}
{/key}
