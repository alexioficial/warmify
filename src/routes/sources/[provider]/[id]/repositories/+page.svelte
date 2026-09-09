<script lang="ts">
	let { data, form } = $props();
</script>

<section class="settings-section">
	<h2>Repositories</h2>
	<p class="muted">Repositories currently available through this GitHub App installation.</p>
	{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if data.repositories.length}
		<form method="POST" action="?/loadBranches" class="actions">
			<label
				>Repository<select name="repository" required>
					{#each data.repositories as repository (repository.fullName)}
						<option value={repository.fullName} selected={form?.repository === repository.fullName}
							>{repository.fullName}{repository.isPrivate ? ' · private' : ''}</option
						>
					{/each}
				</select></label
			>
			<button>Load branches</button>
		</form>
		<div class="table-wrap">
			<table>
				<thead><tr><th>Repository</th><th>Visibility</th><th>Default branch</th></tr></thead>
				<tbody
					>{#each data.repositories as repository (repository.fullName)}<tr
							><td>{repository.fullName}</td><td>{repository.isPrivate ? 'Private' : 'Public'}</td
							><td>{repository.defaultBranch || '—'}</td></tr
						>{/each}</tbody
				>
			</table>
		</div>
		{#if form?.branches}
			<h3>Branches in {form.repository}</h3>
			<ul>
				{#each form.branches as branch (branch)}<li>{branch}</li>{/each}
			</ul>
		{/if}
	{:else if !data.requestError}
		<p>No repositories are available to this installation.</p>
	{/if}
</section>
