<script lang="ts">
	import { resolve } from '$app/paths';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';

	let { data, form } = $props();
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	const servers = $derived(normalizeRecords(data.servers));
	const destinations = $derived(normalizeRecords(data.destinations));
	const privateKeys = $derived(normalizeRecords(data.privateKeys));
	const githubApps = $derived(normalizeRecords(data.githubApps));
	const databaseNames: Record<string, string> = {
		postgresql: 'PostgreSQL',
		mysql: 'MySQL',
		mariadb: 'MariaDB',
		redis: 'Redis',
		keydb: 'KeyDB',
		dragonfly: 'Dragonfly',
		mongodb: 'MongoDB',
		clickhouse: 'ClickHouse'
	};
	const titles: Record<string, string> = {
		'public-repository': 'Public Git Repository',
		'private-deploy-key': 'Private Git Repository (with Deploy Key)',
		'github-app': 'Git Repository (with GitHub App)',
		'gitlab-app': 'Git Repository (with GitLab App)',
		dockerfile: 'Dockerfile',
		'docker-compose': 'Docker Compose',
		'docker-image': 'Docker Image',
		...databaseNames
	};
	const repositoryKind = $derived(
		['public-repository', 'private-deploy-key', 'github-app'].includes(data.kind)
	);
	const databaseKind = $derived(Boolean(databaseNames[data.kind]));
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

{#if data.kind === 'gitlab-app'}
	<section class="settings-section">
		<h2>Unavailable through the public API</h2>
		<p>
			Coolify exposes GitLab App administration, but it does not publish an application-creation
			endpoint that uses a GitLab App. Warmify will not call an undocumented internal endpoint.
		</p>
		<p><a href={resolve('/sources')}>Manage sources</a></p>
	</section>
{:else}
	<form method="POST" class="new-resource-form">
		<fieldset>
			<legend>Destination</legend>
			<div class="field-grid">
				<label>
					Server
					<select name="server_uuid" required>
						<option value="">Select a server</option>
						{#each servers as server (firstText(server, ['uuid', 'id']))}
							<option
								value={firstText(server, ['uuid', 'id'])}
								selected={values.server_uuid === firstText(server, ['uuid', 'id'])}
								>{resourceSummary(server, 'servers').name}</option
							>
						{/each}
					</select>
				</label>
				{#if destinations.length}
					<label>
						Destination
						<select name="destination_uuid">
							<option value="">Server default</option>
							{#each destinations as destination (firstText(destination, ['uuid', 'id']))}
								<option
									value={firstText(destination, ['uuid', 'id'])}
									selected={values.destination_uuid === firstText(destination, ['uuid', 'id'])}
									>{resourceSummary(destination, 'destinations').name}</option
								>
							{/each}
						</select>
					</label>
				{/if}
			</div>
		</fieldset>

		{#if repositoryKind}
			<fieldset>
				<legend>Repository</legend>
				{#if data.kind === 'private-deploy-key'}
					<label>
						Private key
						<select name="private_key_uuid" required>
							<option value="">Select a private key</option>
							{#each privateKeys as key (firstText(key, ['uuid', 'id']))}
								<option
									value={firstText(key, ['uuid', 'id'])}
									selected={values.private_key_uuid === firstText(key, ['uuid', 'id'])}
									>{firstText(key, ['name']) || 'Private key'}</option
								>
							{/each}
						</select>
					</label>
				{:else if data.kind === 'github-app'}
					<label>
						GitHub App
						<select name="github_app_uuid" required>
							<option value="">Select a GitHub App</option>
							{#each githubApps as app (firstText(app, ['uuid', 'id']))}
								<option
									value={firstText(app, ['uuid', 'id'])}
									selected={values.github_app_uuid === firstText(app, ['uuid', 'id'])}
									>{firstText(app, ['name']) || 'GitHub App'}</option
								>
							{/each}
						</select>
					</label>
				{/if}
				<label>
					Repository URL
					<input
						name="git_repository"
						placeholder={data.kind === 'private-deploy-key' ? 'git@github.com:owner/repository.git' : 'https://github.com/owner/repository'}
						value={values.git_repository ?? ''}
						required
					/>
				</label>
				<div class="field-grid">
					<label>Branch <input name="git_branch" value={values.git_branch || 'main'} required /></label>
					<label>
						Build pack
						<select name="build_pack">
							{#each ['nixpacks', 'railpack', 'static', 'dockerfile', 'dockercompose'] as buildPack}
								<option value={buildPack} selected={(values.build_pack || 'nixpacks') === buildPack}>{buildPack}</option>
							{/each}
						</select>
					</label>
					<label>Exposed ports <input name="ports_exposes" value={values.ports_exposes ?? ''} required /></label>
					<label>Domains <input name="domains" value={values.domains ?? ''} /></label>
				</div>
			</fieldset>
		{:else if data.kind === 'dockerfile'}
			<fieldset>
				<legend>Dockerfile</legend>
				<label>
					Dockerfile content
					<textarea class="source-editor" name="dockerfile" placeholder="FROM ..." required></textarea>
				</label>
			</fieldset>
		{:else if data.kind === 'docker-compose'}
			<fieldset>
				<legend>Docker Compose</legend>
				<label>
					Docker Compose file
					<textarea class="source-editor" name="docker_compose" placeholder="services:" required></textarea>
				</label>
			</fieldset>
		{:else if data.kind === 'docker-image'}
			<fieldset>
				<legend>Docker image</legend>
				<label>
					Image name
					<input name="docker_registry_image_name" placeholder="nginx" value={values.docker_registry_image_name ?? ''} required />
				</label>
				<div class="field-grid">
					<label>Tag <input name="docker_registry_image_tag" value={values.docker_registry_image_tag || 'latest'} /></label>
					<label>Exposed ports <input name="ports_exposes" value={values.ports_exposes ?? ''} /></label>
					<label class="wide">Domains <input name="domains" value={values.domains ?? ''} /></label>
				</div>
			</fieldset>
		{:else if databaseKind}
			<fieldset>
				<legend>{databaseNames[data.kind]}</legend>
				<div class="field-grid">
					<label>Docker image override <input name="image" value={values.image ?? ''} /></label>
					<label>Public port <input name="public_port" type="number" value={values.public_port ?? ''} /></label>
				</div>
				<label><input type="checkbox" name="is_public" /> Publicly accessible</label>
			</fieldset>
		{/if}

		<fieldset>
			<legend>General</legend>
			<div class="field-grid">
				<label>Name <input name="name" value={values.name ?? ''} /></label>
				<label>Description <textarea name="description">{values.description ?? ''}</textarea></label>
			</div>
		</fieldset>

		<div class="form-submit">
			<label><input type="checkbox" name="instant_deploy" checked /> Deploy immediately</label>
			<button class="primary" type="submit">Create resource</button>
		</div>
	</form>
{/if}
