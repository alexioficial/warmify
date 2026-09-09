<script lang="ts">
	import { resolve } from '$app/paths';
	import { serverCapabilities } from '$lib/server-capabilities';

	let { data } = $props();
	const base = $derived(`/servers/${encodeURIComponent(data.uuid)}`);
</script>

<svelte:head><title>Server API availability - Warmify</title></svelte:head>
<h2>API availability</h2>
<p class="muted">
	Warmify uses Coolify's public API only. Availability below follows the pinned Coolify reference.
</p>
<div class="table-wrap">
	<table>
		<thead><tr><th>Capability</th><th>Status</th><th>Reason</th></tr></thead>
		<tbody>
			{#each serverCapabilities as capability (capability.name)}
				<tr>
					<td>
						{#if capability.href}
							<a href={resolve(`${base}/${capability.href}` as '/')}>{capability.name}</a>
						{:else}
							{capability.name}
						{/if}
					</td>
					<td>{capability.status}</td>
					<td>{capability.detail}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="muted">
	A missing public endpoint is intentionally not replaced with a private Livewire request.
</p>
