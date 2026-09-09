<script lang="ts">
	import { onMount } from 'svelte';
	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<svelte:head><title>Database tags - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Tags</h2>
	{#if data.requestError}<p class="error">{data.requestError}</p>
	{:else}
		{#each data.tags as tag (tag.uuid)}
			<details>
				<summary>{tag.name}</summary>
				<form method="POST" action="?/deleteTag">
					<input type="hidden" name="tag_uuid" value={tag.uuid} />
					<label
						>Type {tag.name} to remove
						<input name="confirmation" required disabled={!ready} /></label
					>
					<button class="danger" disabled={!ready}>Remove tag</button>
				</form>
			</details>
		{:else}<p class="muted">No tags attached.</p>{/each}
		<form method="POST" action="?/addTags">
			<label
				>Tag names <textarea
					name="tag_names"
					value={form?.tagNames ?? ''}
					placeholder="production, customer-facing"
					required
					disabled={!ready}></textarea></label
			>
			<button class="primary" disabled={!ready}>Add tags</button>
		</form>
	{/if}
</section>
