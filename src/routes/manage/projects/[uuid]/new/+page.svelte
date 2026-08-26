<script lang="ts">
	import { resolve } from '$app/paths';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';

	let { data, form } = $props();
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	let kind = $state('docker-image');
	const environments = $derived(normalizeRecords(data.environments));
	const servers = $derived(normalizeRecords(data.servers));
	const destinations = $derived(normalizeRecords(data.destinations));

	$effect(() => {
		if (values.kind) kind = values.kind;
	});
</script>

<p>
	<a href={resolve('/manage/[group]', { group: 'projects' })}>Projects</a> /
	<a
		href={resolve('/manage/[group]/[uuid]', {
			group: 'projects',
			uuid: data.projectUuid
		})}>{data.projectName}</a
	>
	/
</p>
<h1>New resource</h1>
<p>Choose what Coolify should run in this project.</p>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

<form method="POST">
	<fieldset>
		<legend>Resource type</legend>
		<label>
			Type
			<select name="kind" bind:value={kind}>
				<option value="docker-image">Docker image</option>
				<option value="public-repository">Public repository</option>
				<option value="database">Database</option>
				<option value="service">Service</option>
			</select>
		</label>
	</fieldset>

	<fieldset>
		<legend>Destination</legend>
		<label>
			Environment
			<select name="environment_uuid" required>
				<option value="">Select an environment</option>
				{#each environments as environment (firstText(environment, ['uuid', 'id']))}
					<option
						value={firstText(environment, ['uuid', 'id'])}
						selected={values.environment_uuid === firstText(environment, ['uuid', 'id'])}
						>{firstText(environment, ['name']) || 'Environment'}</option
					>
				{/each}
			</select>
		</label>
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
	</fieldset>

	<fieldset>
		<legend>General</legend>
		<label>Name <input name="name" value={values.name ?? ''} /></label>
		<label>Description <textarea name="description">{values.description ?? ''}</textarea></label>
		<label>Domains <input name="domains" value={values.domains ?? ''} /></label>
	</fieldset>

	{#if kind === 'public-repository'}
		<fieldset>
			<legend>Public repository</legend>
			<label
				>Repository URL <input
					name="git_repository"
					type="url"
					value={values.git_repository ?? ''}
					required
				/></label
			>
			<label>Branch <input name="git_branch" value={values.git_branch ?? 'main'} required /></label>
			<label>
				Build pack
				<select name="build_pack">
					{#each ['nixpacks', 'railpack', 'static', 'dockerfile', 'dockercompose'] as buildPack (buildPack)}
						<option value={buildPack}>{buildPack}</option>
					{/each}
				</select>
			</label>
			<label>Exposed ports <input name="ports_exposes" value={values.ports_exposes ?? ''} /></label>
		</fieldset>
	{:else if kind === 'docker-image'}
		<fieldset>
			<legend>Docker image</legend>
			<label
				>Image <input
					name="docker_registry_image_name"
					placeholder="nginx"
					value={values.docker_registry_image_name ?? ''}
					required
				/></label
			>
			<label
				>Tag <input
					name="docker_registry_image_tag"
					value={values.docker_registry_image_tag ?? 'latest'}
				/></label
			>
			<label
				>Exposed ports <input
					name="ports_exposes"
					placeholder="80"
					value={values.ports_exposes ?? ''}
				/></label
			>
		</fieldset>
	{:else if kind === 'database'}
		<fieldset>
			<legend>Database</legend>
			<label>
				Engine
				<select name="engine">
					{#each ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'keydb', 'dragonfly', 'clickhouse'] as engine (engine)}
						<option value={engine}>{engine}</option>
					{/each}
				</select>
			</label>
			<label>Docker image override <input name="image" value={values.image ?? ''} /></label>
			<label><input type="checkbox" name="is_public" /> Publicly accessible</label>
			<label
				>Public port <input
					type="number"
					name="public_port"
					value={values.public_port ?? ''}
				/></label
			>
		</fieldset>
	{:else if kind === 'service'}
		<fieldset>
			<legend>Service</legend>
			<label
				>One-click service type <input
					name="service_type"
					placeholder="actualbudget"
					value={values.service_type ?? ''}
				/></label
			>
			<p class="muted">Or provide a custom Docker Compose definition.</p>
			<label>Docker Compose <textarea name="docker_compose"></textarea></label>
		</fieldset>
	{/if}

	<label><input type="checkbox" name="instant_deploy" checked /> Deploy immediately</label>
	<button type="submit">Create resource</button>
</form>
