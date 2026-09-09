<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { firstText, normalizeRecords, resourceSummary } from '$lib/resource-presenter';
	import type { ConfigurationField } from '$lib/server/resource-groups';
	let {
		fields,
		servers,
		destinations,
		form = null
	}: {
		fields: ConfigurationField[];
		servers: unknown;
		destinations: unknown;
		form?: {
			error?: string;
			values?: Record<string, string | boolean>;
			fieldErrors?: Record<string, string>;
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
						form?.values?.[field.name] === undefined
							? field.name === 'instant_deploy'
							: form.values[field.name] === true
					])
			)
		)
	);
	const sections = [
		['destination', 'Destination'],
		['general', 'General'],
		['credentials', 'Credentials'],
		['initialization', 'Initialization'],
		['configuration', 'Configuration'],
		['networking', 'Networking'],
		['resource-limits', 'Resource limits']
	];
</script>

<form method="POST" class="new-resource-form">
	<p class="muted">
		Blank optional fields use Coolify defaults. Leave passwords blank to let Coolify generate them.
		Passwords and configuration documents must be entered again if validation fails.
	</p>
	{#each sections as [section, title] (section)}
		{#if fields.some((field) => field.section === section)}
			<fieldset>
				<legend>{title}</legend>
				{#if section === 'networking'}<p class="muted">
						Public exposure opens a database port on the server. Keep it disabled unless external
						access is needed.
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
									aria-describedby={form?.fieldErrors?.[field.name]
										? `${field.name}-error`
										: undefined}
									bind:value={text[field.name]}
									required={field.name === 'server_uuid'}
									disabled={!ready}
								>
									<option value=""
										>{field.name === 'server_uuid'
											? 'Select a server'
											: 'Server default (only when it has one destination)'}</option
									>
									{#each normalizeRecords(field.name === 'server_uuid' ? servers : destinations) as row (firstText( row, ['uuid', 'id'] ))}<option
											value={firstText(row, ['uuid', 'id'])}
											>{resourceSummary(
												row,
												field.name === 'server_uuid' ? 'servers' : 'destinations'
											).name}</option
										>{/each}
								</select>
							{:else if field.type === 'checkbox'}
								<input type="hidden" name={field.name} value="false" /><input
									type="checkbox"
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									value="true"
									bind:checked={flags[field.name]}
									disabled={!ready}
								/>
							{:else if field.type === 'textarea'}
								<textarea
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									aria-describedby={form?.fieldErrors?.[field.name]
										? `${field.name}-error`
										: undefined}
									bind:value={text[field.name]}
									disabled={!ready}
									aria-invalid={form?.fieldErrors?.[field.name] ? 'true' : undefined}></textarea>
							{:else}
								<input
									name={field.name}
									aria-labelledby={`${field.name}-label`}
									aria-describedby={form?.fieldErrors?.[field.name]
										? `${field.name}-error`
										: undefined}
									type={field.type ?? 'text'}
									bind:value={text[field.name]}
									min={field.min}
									max={field.max}
									autocomplete={field.sensitive ? 'new-password' : undefined}
									disabled={!ready}
									aria-invalid={form?.fieldErrors?.[field.name] ? 'true' : undefined}
								/>
							{/if}
							{#if form?.fieldErrors?.[field.name]}<span class="error" id={`${field.name}-error`}
									>{form.fieldErrors[field.name]}</span
								>{/if}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
	{/each}
	<button class="primary" disabled={!ready}>Create database</button>
</form>
