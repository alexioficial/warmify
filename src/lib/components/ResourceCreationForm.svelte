<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';
	import type { ConfigurationField } from '$lib/server/resource-groups';
	let {
		fields,
		servers,
		destinations,
		notice = 'Blank optional fields use Coolify defaults. Source documents are write-only and must be entered again after validation errors.',
		form = null
	}: {
		fields: ConfigurationField[];
		servers: unknown;
		destinations: unknown;
		notice?: string;
		form?: {
			error?: string;
			values?: Record<string, string | boolean>;
			fieldErrors?: Record<string, string>;
			suggestedTypes?: string[];
		} | null;
	} = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
	let text = $state<Record<string, string>>(
		untrack(() =>
			Object.fromEntries(
				fields.map((field) => [
					field.name,
					field.sensitive ? '' : String(form?.values?.[field.name] ?? '')
				])
			)
		)
	);
	let flags = $state<Record<string, boolean>>(
		untrack(() =>
			Object.fromEntries(
				fields
					.filter((field) => field.coerce === 'boolean')
					.map((field) => [
						field.name,
						form?.values?.[field.name] === undefined ? true : form.values[field.name] === true
					])
			)
		)
	);
	const sections = $derived([...new Set(fields.map((field) => field.section))]);
</script>

<form method="POST" class="new-resource-form">
	<p class="muted">{notice}</p>
	{#each sections as section (section)}
		<fieldset>
			<legend>{section}</legend>
			{#if section === 'Template'}<p class="muted">
					Enter the exact template identifier from Coolify, for example actualbudget or
					gitea-with-mysql. The public API does not provide a browsable catalog. Configure generated
					container domains and variables after creation.
				</p>{/if}
			{#if section === 'Docker image'}<p class="muted">
					Enter a full image reference, or a plain image name with either a tag or a SHA256 digest.
					Leave both blank for the image default.
				</p>{/if}
			{#if section === 'Source'}<p class="muted">
					Paste plain text; Warmify encodes it for Coolify. Dockerfile ports are detected by
					Coolify. Configure service domains after creation.
				</p>{/if}
			<div class="field-grid">
				{#each fields.filter((field) => field.section === section) as field (field.name)}
					<label
						class:wide={field.type === 'textarea'}
						class:checkbox-field={field.type === 'checkbox'}
					>
						<span id={`${field.name}-label`}>{field.label}</span>
						{#if field.name === 'server_uuid' || field.name === 'destination_uuid'}
							<select
								name={field.name}
								aria-labelledby={`${field.name}-label`}
								bind:value={text[field.name]}
								required={field.name === 'server_uuid'}
								disabled={!ready}
							>
								<option value=""
									>{field.name === 'server_uuid'
										? 'Select a server'
										: 'Server default (only when it has one destination)'}</option
								>
								{#each normalizeRecords(field.name === 'server_uuid' ? servers : destinations) as row (firstText( row, ['uuid', 'id'] ))}
									<option value={firstText(row, ['uuid', 'id'])}
										>{resourceSummary(
											row,
											field.name === 'server_uuid' ? 'servers' : 'destinations'
										).name}</option
									>
								{/each}
							</select>
						{:else if field.type === 'checkbox'}
							<input type="hidden" name={field.name} value="false" />
							<input
								type="checkbox"
								name={field.name}
								value="true"
								aria-labelledby={`${field.name}-label`}
								bind:checked={flags[field.name]}
								disabled={!ready}
							/>
						{:else if field.type === 'textarea'}
							<textarea
								class:source-editor={field.sensitive}
								name={field.name}
								aria-labelledby={`${field.name}-label`}
								bind:value={text[field.name]}
								disabled={!ready}
								required={field.sensitive}
								aria-describedby={form?.fieldErrors?.[field.name]
									? `${field.name}-error`
									: undefined}></textarea>
						{:else}
							<input
								name={field.name}
								aria-labelledby={`${field.name}-label`}
								bind:value={text[field.name]}
								disabled={!ready}
								required={['docker_registry_image_name', 'type'].includes(field.name)}
								list={field.name === 'type' ? 'template-types' : undefined}
								aria-describedby={form?.fieldErrors?.[field.name]
									? `${field.name}-error`
									: undefined}
							/>
						{/if}
						{#if form?.fieldErrors?.[field.name]}<span class="error" id={`${field.name}-error`}
								>{form.fieldErrors[field.name]}</span
							>{/if}
					</label>
				{/each}
			</div>
		</fieldset>
	{/each}
	{#if form?.suggestedTypes?.length}<p class="muted">
			Coolify returned available template identifiers. Select a suggestion in Template type.
		</p>{/if}
	<datalist id="template-types"
		>{#each form?.suggestedTypes ?? [] as type (type)}<option value={type}
			></option>{/each}</datalist
	>
	<button class="primary" disabled={!ready}>Create resource</button>
</form>
