<script lang="ts">
	import EnvironmentTable from '$lib/components/EnvironmentTable.svelte';
	import RevealSecret from '$lib/components/RevealSecret.svelte';
	interface PageData {
		uuid: string;
		variables?: unknown;
		requestError?: string;
	}
	interface VariableResult {
		target?: string;
		operation?: 'update' | 'delete';
		values?: Record<string, string | boolean>;
		fieldErrors?: Record<string, string>;
		error?: string;
		message?: string;
	}

	let {
		data,
		form,
		kind = 'services'
	}: { data: PageData; form: VariableResult | null; kind?: 'services' | 'databases' } = $props();
	const revealOperation = $derived(`GET:/${kind}/{uuid}/envs`);
	function createInitialValues(): Record<string, string | boolean> {
		return form?.target === 'create' ? (form.values ?? {}) : {};
	}
	const initialCreateValues = createInitialValues();
	let createKey = $state(String(initialCreateValues.key ?? ''));
	let createComment = $state(String(initialCreateValues.comment ?? ''));
	let createOptions = $state([
		{ name: 'is_literal', label: 'Literal', checked: initialCreateValues.isLiteral === true },
		{ name: 'is_multiline', label: 'Multiline', checked: initialCreateValues.isMultiline === true },
		{
			name: 'is_shown_once',
			label: 'Shown once',
			checked: initialCreateValues.isShownOnce === true
		}
	]);
</script>

<svelte:head><title>Environment variables - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Environment variables</h2>
			<p class="muted">Values stay masked until explicitly revealed.</p>
		</div>
		<RevealSecret operationId={revealOperation} parameters={{ uuid: String(data.uuid) }} />
	</div>
	<EnvironmentTable data={data.variables} editable service {form} />
	<details>
		<summary>Add variable</summary>
		<form method="POST" action="?/createVariable">
			<label>Key <input name="key" bind:value={createKey} required /></label>
			{#if form?.target === 'create' && form.fieldErrors?.key}<p class="error">
					{form.fieldErrors.key}
				</p>{/if}
			<label>Value <textarea name="value"></textarea></label>
			<p class="muted">Submitted values are never returned in validation responses.</p>
			<label>Comment <input name="comment" bind:value={createComment} maxlength="256" /></label>
			<div class="inline-list">
				{#each createOptions as option (option.name)}
					<label class="checkbox-field">
						<input type="hidden" name={option.name} value="false" />
						<input type="checkbox" name={option.name} value="true" bind:checked={option.checked} />
						{option.label}
					</label>
				{/each}
			</div>
			<button class="primary" type="submit">Add variable</button>
		</form>
	</details>
	<details>
		<summary>Bulk upsert</summary>
		<form method="POST" action="?/bulkVariables">
			<div class="field-grid">
				<label>Production <textarea name="production" placeholder="KEY=value"></textarea></label>
			</div>
			<p class="muted">Values are write-only here and are not restored after submission.</p>
			{#if form?.target === 'bulk' && form.fieldErrors?.production}<p class="error">
					{form.fieldErrors.production}
				</p>{/if}
			<button class="primary" type="submit">Upsert variables</button>
		</form>
	</details>
</section>
