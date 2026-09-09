<script lang="ts">
	import { resolve } from '$app/paths';
	let { data } = $props();
</script>

<h2>Resources</h2>
<p class="muted">Applications, services and databases assigned to this server.</p>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>
{:else if data.resources.length}
	<div class="table-wrap">
		<table>
			<thead><tr><th>Resource</th><th>Type</th><th>Status</th><th>Updated</th></tr></thead>
			<tbody>
				{#each data.resources as resource (resource.uuid)}
					<tr>
						<td>
							{#if resource.href}<a href={resolve(resource.href)}
									><strong>{resource.name}</strong></a
								>
							{:else}<strong>{resource.name}</strong>{/if}
						</td>
						<td>{resource.type}</td><td>{resource.status}</td><td>{resource.updatedAt || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}<p>No resources on this server.</p>{/if}
