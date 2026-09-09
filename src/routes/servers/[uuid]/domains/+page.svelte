<script lang="ts">
	let { data } = $props();
</script>

<h2>Domains</h2>
<p class="muted">Domains currently routed to resources on this server, grouped by address.</p>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>
{:else if data.domains.length}
	<div class="table-wrap">
		<table>
			<thead><tr><th>IP address</th><th>Domains</th></tr></thead>
			<tbody>
				{#each data.domains as group (group.ip)}
					<tr><td><code>{group.ip || '—'}</code></td><td>{group.domains.join(', ') || '—'}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}<p>No domains reported for this server.</p>{/if}
