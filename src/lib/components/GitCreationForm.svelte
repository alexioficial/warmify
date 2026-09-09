<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { gitBuildPacks, gitCreationFields } from '$lib/git-creation-fields';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';
	import type { loadCreationGitDiscovery } from '$lib/server/git-creation';
	let {
		kind,
		servers,
		destinations,
		privateKeys,
		discovery,
		form = null
	}: {
		kind: string;
		servers: unknown;
		destinations: unknown;
		privateKeys: { uuid: string; name: string }[];
		discovery: Awaited<ReturnType<typeof loadCreationGitDiscovery>> | null;
		form?: {
			error?: string;
			values?: Record<string, string | boolean>;
			fieldErrors?: Record<string, string>;
		} | null;
	} = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	let text = $state<Record<string, string>>(
		untrack(() => ({
			...Object.fromEntries(
				gitBuildPacks
					.flatMap((pack) => gitCreationFields(kind, pack))
					.map((field) => [
						field.name,
						field.sensitive ? '' : String(form?.values?.[field.name] ?? '')
					])
			),
			build_pack: String(form?.values?.build_pack || 'railpack'),
			git_branch: String(form?.values?.git_branch || 'main'),
			base_directory: String(form?.values?.base_directory ?? '/'),
			dockerfile_location: String(form?.values?.dockerfile_location ?? '/Dockerfile'),
			docker_compose_location: String(
				form?.values?.docker_compose_location ?? '/docker-compose.yaml'
			),
			github_app_uuid: String(
				form?.values?.github_app_uuid ??
					discovery?.githubApps.find((app) => app.id === discovery.selectedGithubAppId)?.uuid ??
					''
			),
			git_repository: String(
				form?.values?.git_repository ??
					(discovery?.repositories.some((repo) => repo.fullName === discovery.selectedRepository)
						? discovery.selectedRepository
						: '')
			)
		}))
	);
	let flags = $state<Record<string, boolean>>(
		untrack(() => ({
			instant_deploy:
				form?.values?.instant_deploy === undefined ? true : form.values.instant_deploy === true,
			autogenerate_domain:
				form?.values?.autogenerate_domain === undefined
					? true
					: form.values.autogenerate_domain === true,
			is_static: form?.values?.is_static === true
		}))
	);
	let appId = $state(untrack(() => discovery?.selectedGithubAppId ?? ''));
	let repository = $state(untrack(() => discovery?.selectedRepository ?? ''));
	const fields = $derived(gitCreationFields(kind, text.build_pack));
	function sources(name: string) {
		return name === 'private_key_uuid' ? privateKeys : (discovery?.githubApps ?? []);
	}
	const sections = [
		'Destination',
		'Repository',
		'Build configuration',
		'Networking',
		'General',
		'Create'
	];
</script>

{#if discovery}
	<section class="settings-section" aria-label="GitHub discovery">
		<h2>Choose repository</h2>
		<p class="muted">
			Discover repositories and branches first, then configure the application below. Reloading
			discovery starts a new configuration draft.
		</p>
		{#if discovery.discoveryError}<p class="error" role="alert">{discovery.discoveryError}</p>{/if}
		<form method="GET" class="field-grid">
			<label
				>Discover with GitHub App
				<select name="github_app_id" bind:value={appId} disabled={!ready} required>
					<option value="">Select an App</option>
					{#each discovery.githubApps as app (app.id)}<option value={app.id}>{app.name}</option
						>{/each}
				</select>
			</label>
			<button disabled={!ready || !appId}>Load repositories</button>
		</form>
		{#if discovery.repositories.length}
			<form method="GET" class="field-grid">
				<input type="hidden" name="github_app_id" value={discovery.selectedGithubAppId} />
				<label
					>Discover branches for repository
					<select name="repository" bind:value={repository} disabled={!ready} required>
						<option value="">Select a repository</option>
						{#each discovery.repositories as repo (repo.fullName)}<option value={repo.fullName}
								>{repo.fullName}</option
							>{/each}
					</select>
				</label>
				<button disabled={!ready || !repository}>Load branches</button>
			</form>
		{/if}
		{#if !discovery.githubApps.length}<p>
				No GitHub Apps available. <a href={resolve('/sources')}>Manage sources</a>
			</p>{/if}
	</section>
{/if}

<form method="POST" class="new-resource-form" aria-label="Create Git application">
	<p class="muted">
		Coolify validates repository access when creating the application. Blank optional fields use its
		defaults. Custom commands are write-only and must be entered again after errors.
	</p>
	{#each sections as section (section)}
		{#if fields.some((field) => field.section === section)}
			<fieldset>
				<legend>{section}</legend>
				{#if section === 'Build configuration' && text.build_pack === 'dockercompose'}<p
						class="muted"
					>
						Coolify loads the Compose file from this repository. Configure domains per service after
						creation; ordinary application domains and exposed ports do not apply.
					</p>{/if}
				<div class="field-grid">
					{#each fields.filter((field) => field.section === section) as field (field.name)}
						<label
							class:wide={field.type === 'textarea'}
							class:checkbox-field={field.type === 'checkbox'}
						>
							<span id={`${field.name}-label`}>{field.label}</span>
							{#if field.name === 'server_uuid' || field.name === 'destination_uuid'}
								<select
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									bind:value={text[field.name]}
									disabled={!ready}
									required={field.name === 'server_uuid'}
								>
									<option value=""
										>{field.name === 'server_uuid'
											? 'Select a server'
											: 'Server default (only with one destination)'}</option
									>
									{#each normalizeRecords(field.name === 'server_uuid' ? servers : destinations) as row (firstText( row, ['uuid', 'id'] ))}
										<option value={firstText(row, ['uuid', 'id'])}
											>{resourceSummary(
												row,
												field.name === 'server_uuid' ? 'servers' : 'destinations'
											).name}</option
										>
									{/each}
								</select>
							{:else if field.name === 'private_key_uuid' || field.name === 'github_app_uuid'}
								<select
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									bind:value={text[field.name]}
									disabled={!ready}
									required
								>
									<option value="">Select a source</option>
									{#each sources(field.name) as source (source.uuid)}<option value={source.uuid}
											>{source.name}</option
										>{/each}
								</select>
							{:else if field.type === 'select'}
								<select
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									bind:value={text[field.name]}
									disabled={!ready}
								>
									{#each field.options ?? [] as option (option.value)}<option value={option.value}
											>{option.label}</option
										>{/each}
								</select>
							{:else if field.type === 'checkbox'}
								<input type="hidden" name={field.name} value="false" /><input
									type="checkbox"
									name={field.name}
									value="true"
									aria-labelledby={`${field.name}-label`}
									bind:checked={flags[field.name]}
									disabled={!ready}
								/>
							{:else if field.type === 'textarea'}
								<textarea
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									bind:value={text[field.name]}
									disabled={!ready}></textarea>
							{:else}
								<input
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									bind:value={text[field.name]}
									disabled={!ready}
									required={['git_repository', 'git_branch'].includes(field.name)}
									list={field.name === 'git_branch' ? 'git-branches' : undefined}
									aria-describedby={form?.fieldErrors?.[field.name]
										? `${field.name}-error`
										: undefined}
								/>
							{/if}
							{#if form?.fieldErrors?.[field.name]}<span class="error" id={`${field.name}-error`}
									>{form.fieldErrors[field.name]}</span
								>{/if}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
	{/each}
	<datalist id="git-branches"
		>{#each discovery?.branches ?? [] as branch (branch.name)}<option value={branch.name}
			></option>{/each}</datalist
	>
	<button class="primary" disabled={!ready}>Create application</button>
</form>
