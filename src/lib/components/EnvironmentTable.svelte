<script lang="ts">
	import EnvironmentVariableActions from '$lib/components/EnvironmentVariableActions.svelte';
	import { environmentVariableSummary, normalizeRecords } from '$lib/resource-presenter';

	interface VariableActionResult {
		error?: string;
		message?: string;
		target?: string;
		operation?: 'update' | 'delete';
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean>;
	}

	let {
		data,
		editable = false,
		service = false,
		form = null
	}: {
		data: unknown;
		editable?: boolean;
		service?: boolean;
		form?: VariableActionResult | null;
	} = $props();
	const variables = $derived(normalizeRecords(data).map(environmentVariableSummary));
</script>

{#if variables.length}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">Key</th>
					<th scope="col">Value</th>
					{#if !service}<th scope="col">Environment</th>
						<th scope="col">Buildtime</th>
						<th scope="col">Runtime</th>{/if}
					<th scope="col">Options</th>
					{#if editable}<th scope="col">Actions</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each variables as variable, index (variable.id || index)}
					<tr>
						<td>
							<code>{variable.key}</code>
							{#if variable.comment}<small class="variable-comment">{variable.comment}</small>{/if}
						</td>
						<td><code>{variable.value}</code></td>
						{#if !service}<td>{variable.scope}</td>
							<td>{variable.isBuildtime ? 'Yes' : 'No'}</td>
							<td>{variable.isRuntime ? 'Yes' : 'No'}</td>{/if}
						<td>
							{[
								variable.isLiteral ? 'Literal' : '',
								variable.isMultiline ? 'Multiline' : '',
								variable.isShownOnce ? 'Shown once' : ''
							]
								.filter(Boolean)
								.join(', ') || '-'}
						</td>
						{#if editable}
							<td>
								{#key `${variable.id}:${variable.comment}:${variable.isLiteral}:${variable.isMultiline}:${variable.isShownOnce}:${variable.isBuildtime}:${variable.isRuntime}`}
									<EnvironmentVariableActions {variable} {form} {service} />
								{/key}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No environment variables.</p>
{/if}
