<script lang="ts">
	import EnvironmentTable from '$lib/components/EnvironmentTable.svelte';
	import RevealSecret from '$lib/components/RevealSecret.svelte';

	interface VariableActionResult {
		error?: string;
		message?: string;
		target?: string;
		operation?: 'update' | 'delete';
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean>;
	}

	interface EnvironmentPageData {
		applicationName: string;
		uuid: string;
		variables: unknown;
		requestError?: string;
	}

	let { data, form }: { data: EnvironmentPageData; form: VariableActionResult | null } = $props();
	const revealOperation = 'GET:/applications/{uuid}/envs';
	function createInitialValues() {
		return form?.target === 'create' ? (form.values ?? {}) : {};
	}
	const initialCreateValues = createInitialValues();
	let createKey = $state(String(initialCreateValues.key ?? ''));
	let createComment = $state(String(initialCreateValues.comment ?? ''));
	let createOptions = $state([
		{ name: 'is_preview', label: 'Preview', checked: initialCreateValues.isPreview === true },
		{ name: 'is_literal', label: 'Literal', checked: initialCreateValues.isLiteral === true },
		{ name: 'is_multiline', label: 'Multiline', checked: initialCreateValues.isMultiline === true },
		{
			name: 'is_shown_once',
			label: 'Shown once',
			checked: initialCreateValues.isShownOnce === true
		},
		{
			name: 'is_buildtime',
			label: 'Buildtime',
			checked: initialCreateValues.isBuildtime !== false
		},
		{ name: 'is_runtime', label: 'Runtime', checked: initialCreateValues.isRuntime !== false }
	]);
</script>

<svelte:head><title>Environment variables - {data.applicationName} - Warmify</title></svelte:head>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Environment variables</h2>
			<p class="muted">Values stay masked until you explicitly reveal them.</p>
		</div>
		<div class="actions">
			<RevealSecret operationId={revealOperation} parameters={{ uuid: String(data.uuid) }} />
		</div>
	</div>
	<EnvironmentTable data={data.variables} editable {form} />

	<details>
		<summary>Add variable</summary>
		<form method="POST" action="?/createVariable">
			<label>
				Key
				<input
					name="key"
					bind:value={createKey}
					required
					aria-invalid={form?.target === 'create' && form.fieldErrors?.key ? 'true' : undefined}
				/>
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.key}
				<p class="error">{form.fieldErrors.key}</p>
			{/if}
			<label>
				Value
				<textarea name="value"></textarea>
			</label>
			<p class="muted">Submitted values are never returned in validation responses.</p>
			<label>
				Comment
				<input name="comment" bind:value={createComment} maxlength="256" />
			</label>
			{#if form?.target === 'create' && form.fieldErrors?.comment}
				<p class="error">{form.fieldErrors.comment}</p>
			{/if}
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
		<p class="muted">
			Enter only the variables to create or replace. Existing variables not listed here are left
			alone.
		</p>
		<form method="POST" action="?/bulkVariables">
			<div class="field-grid">
				<label>
					Production
					<textarea name="production" placeholder="KEY=value"></textarea>
					{#if form?.target === 'bulk' && form.fieldErrors?.production}
						<span class="error">{form.fieldErrors.production}</span>
					{/if}
				</label>
				<label>
					Preview deployments
					<textarea name="preview" placeholder="KEY=value"></textarea>
					{#if form?.target === 'bulk' && form.fieldErrors?.preview}
						<span class="error">{form.fieldErrors.preview}</span>
					{/if}
				</label>
			</div>
			<p class="muted">
				For safety, bulk values are not put back into the page after submission. Comments and blank
				lines are ignored.
			</p>
			<button class="primary" type="submit">Upsert variables</button>
		</form>
	</details>
</section>
