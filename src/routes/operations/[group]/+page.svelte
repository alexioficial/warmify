<script lang="ts">
	import { resolve } from '$app/paths';
	import RevealSecret from '$lib/components/RevealSecret.svelte';

	let { data, form } = $props();
	const title = $derived(`${data.group.charAt(0).toUpperCase()}${data.group.slice(1)}`);
	const queryPlaceholder = '{"force":true}';
	const bodyPlaceholder = '{}';
</script>

<p><a href={resolve('/operations')}>API operations</a> /</p>
<h1>{title} operations</h1>
{#if data.endpoints.length === 0}<p class="error">Unknown API operation group.</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.result !== undefined}
	<h2>Operation result</h2>
	<pre>{JSON.stringify(form.result, null, 2)}</pre>
	{#if form.reveal}<RevealSecret
			operationId={form.reveal.operationId}
			parameters={form.reveal.parameters}
		/>{/if}
{/if}

{#each data.endpoints as endpoint (endpoint.id)}
	<details>
		<summary><strong>{endpoint.method}</strong> {endpoint.path}</summary>
		<form method="POST">
			<input type="hidden" name="operationId" value={endpoint.id} />
			{#each endpoint.pathParameters as parameter (parameter)}
				<label>{parameter} <input name={`param:${parameter}`} required /></label>
			{/each}
			<label>Query JSON <textarea name="query" placeholder={queryPlaceholder}></textarea></label>
			{#if endpoint.method !== 'GET'}
				<label>JSON body <textarea name="body" placeholder={bodyPlaceholder}></textarea></label>
			{/if}
			{#if endpoint.risk === 'delete'}
				<p class="danger">This operation deletes data. Type the first path parameter exactly.</p>
				<label>Deletion confirmation <input name="confirmation" required /></label>
			{:else if endpoint.risk === 'confirm'}
				{#if endpoint.id === 'POST:/disable'}
					<p class="danger">
						Disabling the Coolify API will lock Warmify out until you re-enable it from Coolify
						itself.
					</p>
				{/if}
				<label
					><input name="confirmation" type="checkbox" value="confirm" required /> I understand and confirm
					this operation.</label
				>
			{/if}
			<button type="submit">Run operation</button>
		</form>
	</details>
{/each}
