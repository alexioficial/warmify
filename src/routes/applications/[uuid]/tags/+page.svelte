<script lang="ts">
	import { onMount } from 'svelte';
	import type { ApplicationTagSummary } from '$lib/server/application-operations';

	interface PageData {
		tags: ApplicationTagSummary[];
		requestError?: string;
	}

	let { data }: { data: PageData } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Tags - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<h2>Tags</h2>
	<p class="muted">Attach and remove application tags.</p>
	{#if data.tags.length}
		<div class="table-wrap">
			<table>
				<thead><tr><th>Tag</th><th>Identifier</th><th>Action</th></tr></thead>
				<tbody>
					{#each data.tags as tag (tag.uuid)}
						<tr>
							<td><strong>{tag.name}</strong></td>
							<td><code>{tag.uuid}</code></td>
							<td>
								<details>
									<summary>Remove</summary>
									<form method="POST" action="?/deleteTag">
										<input type="hidden" name="tag_uuid" value={tag.uuid} />
										<label>
											Type {tag.name} to confirm
											<input name="confirmation" disabled={!ready} required />
										</label>
										<button class="danger" type="submit" disabled={!ready}>Remove tag</button>
									</form>
								</details>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">No tags attached.</p>
	{/if}
	<details>
		<summary>Add tags</summary>
		<form method="POST" action="?/addTags">
			<label>
				Tag names
				<textarea
					name="tag_names"
					placeholder="production, customer-facing"
					disabled={!ready}
					required></textarea>
			</label>
			<p class="muted">Separate multiple tags with commas or new lines.</p>
			<button class="primary" type="submit" disabled={!ready}>Add tags</button>
		</form>
	</details>
</section>
