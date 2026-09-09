<script lang="ts">
	import SharedVariableForm from './SharedVariableForm.svelte';
	import SharedVariableReveal from './SharedVariableReveal.svelte';
	import type {
		loadSharedVariables,
		loadServerSharedVariables,
		loadTeamSharedVariables,
		SharedVariableResult
	} from '$lib/server/shared-variables';
	type SharedVariableData =
		| Awaited<ReturnType<typeof loadSharedVariables>>
		| Awaited<ReturnType<typeof loadServerSharedVariables>>
		| Awaited<ReturnType<typeof loadTeamSharedVariables>>;
	let { data, form }: { data: SharedVariableData; form?: SharedVariableResult | null } = $props();
</script>

{#key data.href}
	<h2>Shared variables</h2>
	<p class="muted">
		Variables in this {data.kind} can be referenced by its resources. Values stay hidden until explicitly
		revealed. Shown-once values cannot be retrieved.
	</p>
	{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	{#if data.variables.length}
		<div class="table-wrap">
			<table>
				<thead
					><tr><th>Key</th><th>Value</th><th>Options</th><th>Comment</th><th>Actions</th></tr
					></thead
				>
				<tbody
					>{#each data.variables as variable (variable.id)}
						<tr
							><td><strong>{variable.key}</strong></td><td>
								{#if variable.is_shown_once}<span class="muted">Shown once — unavailable</span>
								{:else}<SharedVariableReveal url={data.revealHref} id={variable.id} />{/if}
							</td><td
								>{[
									variable.is_literal ? 'Literal' : '',
									variable.is_multiline ? 'Multiline' : '',
									variable.is_shown_once ? 'Shown once' : ''
								]
									.filter(Boolean)
									.join(', ') || '—'}</td
							><td>{variable.comment || '—'}</td><td>
								<details
									{...form?.target === variable.id && form.operation === 'update' && form.error
										? { open: true }
										: {}}
								>
									<summary>Edit</summary><SharedVariableForm {variable} {form} />
								</details>
								<details
									{...form?.target === variable.id && form.operation === 'delete' && form.error
										? { open: true }
										: {}}
								>
									<summary>Delete</summary>
									<form method="POST" action="?/deleteVariable">
										<input type="hidden" name="id" value={variable.id} />
										<label
											>Type {variable.key} to confirm<input
												name="confirmation"
												autocomplete="off"
												required
											/></label
										>
										<p class="muted">
											Resources referencing this shared key may need reconfiguration.
										</p>
										<button class="danger" type="submit">Delete variable</button>
									</form>
								</details>
							</td></tr
						>
					{/each}</tbody
				>
			</table>
		</div>
	{:else if !data.requestError}<p>No shared variables in this {data.kind}.</p>{/if}
	<details {...form?.target === 'create' && form.error ? { open: true } : {}}>
		<summary>Add shared variable</summary><SharedVariableForm {form} />
	</details>
{/key}
