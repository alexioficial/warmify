<script lang="ts">
	import type { EnvironmentVariableSummary } from '$lib/resource-presenter';

	interface VariableActionResult {
		target?: string;
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean>;
	}

	let {
		variable,
		service = false,
		form = null
	}: {
		variable: EnvironmentVariableSummary;
		service?: boolean;
		form?: VariableActionResult | null;
	} = $props();

	function submitted(name: string, fallback: string | boolean) {
		return form?.target === variable.id && form.values?.[name] !== undefined
			? form.values[name]
			: fallback;
	}

	function initialOptions() {
		return [
			{
				name: 'is_literal',
				label: 'Literal',
				checked: submitted('isLiteral', variable.isLiteral) === true
			},
			{
				name: 'is_multiline',
				label: 'Multiline',
				checked: submitted('isMultiline', variable.isMultiline) === true
			},
			{
				name: 'is_shown_once',
				label: 'Shown once',
				checked: submitted('isShownOnce', variable.isShownOnce) === true
			},
			{
				name: 'is_buildtime',
				label: 'Buildtime',
				checked: submitted('isBuildtime', variable.isBuildtime) === true
			},
			{
				name: 'is_runtime',
				label: 'Runtime',
				checked: submitted('isRuntime', variable.isRuntime) === true
			}
		];
	}

	function initialComment() {
		return String(submitted('comment', variable.comment));
	}

	let comment = $state(initialComment());
	let options = $state(initialOptions());
</script>

<div class="actions variable-actions">
	<details>
		<summary>Edit</summary>
		<form method="POST" action="?/updateVariable">
			<input type="hidden" name="env_uuid" value={variable.id} />
			<input type="hidden" name="key" value={variable.key} />
			{#if !service}<input
					type="hidden"
					name="is_preview"
					value={String(variable.isPreview)}
				/>{/if}
			<p><strong>{variable.key}</strong></p>
			<p class="muted">The key and environment identify this variable in the public API.</p>
			<label>
				Replacement value
				<textarea
					name="value"
					aria-invalid={form?.target === variable.id && form.fieldErrors?.value
						? 'true'
						: undefined}></textarea>
			</label>
			{#if form?.target === variable.id && form.fieldErrors?.value}
				<p class="error">{form.fieldErrors.value}</p>
			{/if}
			<p class="muted">
				For safety, the existing value is never put into the page. An empty value clears it.
			</p>
			<label>
				Comment
				<input name="comment" bind:value={comment} maxlength="256" />
			</label>
			{#if form?.target === variable.id && form.fieldErrors?.comment}
				<p class="error">{form.fieldErrors.comment}</p>
			{/if}
			<div class="inline-list">
				{#each options as option (option.name)}
					{#if !service || !['is_buildtime', 'is_runtime'].includes(option.name)}
						<label class="checkbox-field">
							<input type="hidden" name={option.name} value="false" />
							<input
								type="checkbox"
								name={option.name}
								value="true"
								bind:checked={option.checked}
							/>
							{option.label}
						</label>
					{/if}
				{/each}
			</div>
			<button class="primary" type="submit">Save variable</button>
		</form>
	</details>
	<details>
		<summary>Delete</summary>
		<form method="POST" action="?/deleteVariable">
			<input type="hidden" name="env_uuid" value={variable.id} />
			<label>
				Type <code>{variable.key}</code> to confirm
				<input name="confirmation" autocomplete="off" required />
			</label>
			<button class="danger" type="submit">Delete variable</button>
		</form>
	</details>
</div>
