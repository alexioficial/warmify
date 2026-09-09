<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>{data.team.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.team.name}</h1>
		<p class="muted">{data.team.description || 'No description'}</p>
	</div>
	<div class="actions">
		<a href={resolve(`/teams/${data.team.id}/shared-variables` as '/')}>Shared variables</a>
		<a href={resolve('/teams')}>All teams</a>
	</div>
</div>
<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Members</h2>
			<p class="muted">Read-only membership exposed by the public API.</p>
		</div>
		<span>{data.members.length} member{data.members.length === 1 ? '' : 's'}</span>
	</div>
	{#if data.members.length}
		<div class="table-wrap">
			<table>
				<thead
					><tr
						><th>Name</th><th>Email</th><th>Verified</th><th>Two-factor</th><th>Password reset</th
						></tr
					></thead
				>
				<tbody>
					{#each data.members as member (member.id)}
						<tr>
							<td><strong>{member.name}</strong></td>
							<td>{member.email || '—'}</td>
							<td>{member.emailVerifiedAt ? 'Yes' : 'No'}</td>
							<td>{member.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</td>
							<td>{member.forcePasswordReset ? 'Required' : 'Not required'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}<p>No members returned by the public API.</p>{/if}
</section>
