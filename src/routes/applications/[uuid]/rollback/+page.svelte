<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { formatTimestamp } from '$lib/resource-presenter';
	import type { RollbackImageSummary } from '$lib/server/application-operations';

	interface PageData {
		current: string;
		images: RollbackImageSummary[];
		requestError?: string;
	}

	let { data, form }: { data: PageData; form: { deploymentUuid?: string } | null } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Rollback - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.deploymentUuid}
	<p>
		<a href={resolve('/deployments/[uuid]', { uuid: form.deploymentUuid })}
			>Open rollback deployment</a
		>
	</p>
{/if}
<section class="settings-section">
	<h2>Rollback</h2>
	<p class="muted">Choose a retained image and queue a confirmed rollback deployment.</p>
	{#if data.current}<p>Current image: <code>{data.current}</code></p>{/if}
	{#if data.images.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Image tag</th><th>Created</th><th>Status</th><th>Action</th></tr></thead>
				<tbody>
					{#each data.images as image (image.tag)}
						<tr>
							<td><code>{image.tag}</code></td>
							<td>{formatTimestamp(image.createdAt)}</td>
							<td>{image.isCurrent ? 'Current' : 'Available'}</td>
							<td>
								{#if !image.isCurrent}
									<details>
										<summary>Roll back</summary>
										<form method="POST" action="?/rollback">
											<input type="hidden" name="commit" value={image.tag} />
											<label>
												Type rollback {image.tag} to confirm
												<input name="confirmation" disabled={!ready} required />
											</label>
											<button class="danger" type="submit" disabled={!ready}>Queue rollback</button>
										</form>
									</details>
								{:else}
									<span class="muted">In use</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">No rollback images are available from the application server.</p>
	{/if}
</section>
