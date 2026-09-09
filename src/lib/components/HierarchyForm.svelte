<script lang="ts">
	import { onMount, untrack } from 'svelte';
	let {
		action,
		label,
		name = '',
		description = '',
		nameOnly = false,
		form
	}: {
		action: string;
		label: string;
		name?: string;
		description?: string;
		nameOnly?: boolean;
		form?: {
			error?: string;
			message?: string;
			values?: { name?: string; description?: string };
			fieldErrors?: Record<string, string>;
		} | null;
	} = $props();
	// Avoid editing while hydration restores the last submitted draft.
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let nameValue = $state(untrack(() => form?.values?.name ?? name));
	let descriptionValue = $state(untrack(() => form?.values?.description ?? description));
</script>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}
<form method="POST" {action}>
	<label for="hierarchy-name">Name</label>
	<input
		id="hierarchy-name"
		name="name"
		bind:value={nameValue}
		disabled={!ready}
		required
		minlength="3"
		maxlength="255"
		aria-invalid={!!form?.fieldErrors?.name}
		aria-describedby={form?.fieldErrors?.name ? 'hierarchy-name-error' : undefined}
	/>
	{#if form?.fieldErrors?.name}<p id="hierarchy-name-error" class="error">
			{form.fieldErrors.name}
		</p>{/if}
	{#if !nameOnly}
		<label for="hierarchy-description">Description</label>
		<textarea
			id="hierarchy-description"
			name="description"
			maxlength="255"
			bind:value={descriptionValue}
			disabled={!ready}
			aria-invalid={!!form?.fieldErrors?.description}
			aria-describedby={form?.fieldErrors?.description ? 'hierarchy-description-error' : undefined}
		></textarea>
		{#if form?.fieldErrors?.description}<p id="hierarchy-description-error" class="error">
				{form.fieldErrors.description}
			</p>{/if}
	{/if}
	<button class="primary" type="submit" disabled={!ready}>{label}</button>
</form>
