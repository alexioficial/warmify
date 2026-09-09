<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { SharedVariableRow, SharedVariableResult } from '$lib/server/shared-variables';
	let { variable, form }: { variable?: SharedVariableRow; form?: SharedVariableResult | null } =
		$props();
	const target = $derived(variable?.id ?? 'create');
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const submitted = untrack(() => (form?.target === target ? form.values : undefined));
	let key = $state(untrack(() => submitted?.key ?? variable?.key ?? ''));
	let comment = $state(untrack(() => submitted?.comment ?? variable?.comment ?? ''));
	let mode = $state('keep');
	let options = $state(
		untrack(() => [
			{
				name: 'is_literal',
				label: 'Literal',
				checked: submitted?.is_literal ?? variable?.is_literal ?? false
			},
			{
				name: 'is_multiline',
				label: 'Multiline',
				checked: submitted?.is_multiline ?? variable?.is_multiline ?? false
			},
			{
				name: 'is_shown_once',
				label: 'Shown once',
				checked: submitted?.is_shown_once ?? variable?.is_shown_once ?? false
			}
		])
	);
</script>

<form method="POST" action={variable ? '?/updateVariable' : '?/createVariable'}>
	{#if variable}<input type="hidden" name="id" value={variable.id} />{/if}
	<label for={`shared-key-${target}`}>Key</label>
	<input
		id={`shared-key-${target}`}
		name="key"
		bind:value={key}
		required
		maxlength="255"
		disabled={!ready}
	/>
	<label for={`shared-comment-${target}`}>Comment</label>
	<input
		id={`shared-comment-${target}`}
		name="comment"
		bind:value={comment}
		maxlength="256"
		disabled={!ready}
	/>
	{#if variable}
		<label for={`shared-mode-${target}`}>Stored value</label>
		<select id={`shared-mode-${target}`} name="value_mode" bind:value={mode} disabled={!ready}>
			<option value="keep">Keep current value</option>
			<option value="replace">Replace value</option>
			<option value="clear">Clear value (null)</option>
		</select>
	{/if}
	<label for={`shared-value-${target}`}>{variable ? 'Replacement value' : 'Value'}</label>
	<textarea
		id={`shared-value-${target}`}
		name="value"
		disabled={!ready || (!!variable && mode !== 'replace')}></textarea>
	<p class="muted">
		Values are write-only here and never restored after submission.{variable
			? ' Keeping the current value lets you change its key, comment or flags without changing the secret.'
			: ''}
	</p>
	{#if variable && mode === 'clear'}<p class="error">
			Saving will clear this variable's stored value.
		</p>{/if}
	<div class="inline-list">
		{#each options as option (option.name)}
			<label class="checkbox-field"
				><input type="hidden" name={option.name} value="false" /><input
					type="checkbox"
					name={option.name}
					value="true"
					bind:checked={option.checked}
					disabled={!ready}
				/>{option.label}</label
			>
		{/each}
	</div>
	{#if form?.target === target && form.fieldErrors}
		{#each Object.entries(form.fieldErrors) as [field, message] (field)}<p class="error">
				{message}
			</p>{/each}
	{/if}
	<button class="primary" type="submit" disabled={!ready}
		>{variable ? 'Save variable' : 'Add variable'}</button
	>
</form>
