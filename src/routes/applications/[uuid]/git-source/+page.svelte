<script lang="ts">
	import { onMount } from 'svelte';
	import { asRecord, firstText } from '$lib/resource-presenter';
	import type {
		GithubAppOption,
		GithubBranchOption,
		GithubRepositoryOption
	} from '$lib/server/application-operations';

	interface PageData {
		application: unknown;
		githubApps: GithubAppOption[];
		repositories: GithubRepositoryOption[];
		branches: GithubBranchOption[];
		selectedGithubAppId: string;
		selectedRepository: string;
		discoveryError?: string;
	}

	interface ActionResult {
		section?: string;
		values?: Record<string, string | boolean>;
		fieldErrors?: Record<string, string>;
	}

	let { data, form }: { data: PageData; form: ActionResult | null } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	const application = $derived(asRecord(data.application));
	const values = $derived(form?.section === 'git-source' ? (form.values ?? {}) : {});
	const errors = $derived(form?.section === 'git-source' ? (form.fieldErrors ?? {}) : {});

	function value(name: string, discovered = ''): string {
		if (Object.hasOwn(values, name)) return String(values[name]);
		return discovered || firstText(application, [name]);
	}
</script>

<svelte:head><title>Git source - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Repository discovery</h2>
	<p class="muted">
		Repositories and branches are loaded through the configured Coolify GitHub App.
	</p>
	{#if data.discoveryError}<p class="error" role="alert">{data.discoveryError}</p>{/if}
	<form method="GET">
		<label>
			GitHub App
			<select name="github_app_id" disabled={!ready}>
				<option value="">Choose a GitHub App</option>
				{#each data.githubApps as app (app.id)}
					<option value={app.id} selected={app.id === data.selectedGithubAppId}>{app.name}</option>
				{/each}
			</select>
		</label>
		{#if data.repositories.length}
			<label>
				Repository
				<select name="repository" disabled={!ready}>
					<option value="">Choose a repository</option>
					{#each data.repositories as repository (repository.fullName)}
						<option
							value={repository.fullName}
							selected={repository.fullName === data.selectedRepository}
						>
							{repository.fullName}
						</option>
					{/each}
				</select>
			</label>
		{/if}
		<button type="submit" disabled={!ready}>Load repository options</button>
	</form>
</section>

<section class="settings-section">
	<h2>Git source</h2>
	<form method="POST" action="?/save">
		<input type="hidden" name="_section" value="git-source" />
		<label>
			Repository
			<input
				name="git_repository"
				value={value('git_repository', data.selectedRepository)}
				disabled={!ready}
			/>
			{#if errors.git_repository}<span class="error">{errors.git_repository}</span>{/if}
		</label>
		<label>
			Branch
			{#if data.branches.length}
				<select name="git_branch" disabled={!ready}>
					<option value={value('git_branch')}>{value('git_branch') || 'Choose a branch'}</option>
					{#each data.branches.filter((branch) => branch.name !== value('git_branch')) as branch (branch.name)}
						<option value={branch.name}>{branch.name}</option>
					{/each}
				</select>
			{:else}
				<input name="git_branch" value={value('git_branch')} disabled={!ready} />
			{/if}
			{#if errors.git_branch}<span class="error">{errors.git_branch}</span>{/if}
		</label>
		<label>
			Commit SHA <span class="muted">(optional)</span>
			<input name="git_commit_sha" value={value('git_commit_sha')} disabled={!ready} />
		</label>
		<button class="primary" type="submit" disabled={!ready}>Save Git source</button>
	</form>
</section>
