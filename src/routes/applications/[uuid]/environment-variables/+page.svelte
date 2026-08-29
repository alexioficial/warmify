<script lang="ts">
	import EnvironmentTable from '$lib/components/EnvironmentTable.svelte';
	import RevealSecret from '$lib/components/RevealSecret.svelte';
	let { data } = $props();
	const revealOperation = 'GET:/applications/{uuid}/envs';
</script>

<svelte:head><title>Environment variables - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section>
	<div class="section-heading">
		<h2>Environment variables</h2>
		<RevealSecret operationId={revealOperation} parameters={{ uuid: data.uuid }} />
	</div>
	<EnvironmentTable data={data.variables} />
	<details>
		<summary>Add variable</summary>
		<form method="POST" action="?/createVariable">
			<label>Key <input name="key" required /></label>
			<label>Value <textarea name="value" required></textarea></label>
			<div class="inline-list">
				<label><input type="checkbox" name="is_build_time" /> Build time</label>
				<label><input type="checkbox" name="is_preview" /> Preview</label>
				<label><input type="checkbox" name="is_literal" /> Literal</label>
				<label><input type="checkbox" name="is_multiline" /> Multiline</label>
			</div>
			<button class="primary" type="submit">Add variable</button>
		</form>
	</details>
</section>
