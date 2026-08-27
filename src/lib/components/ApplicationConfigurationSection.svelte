<script lang="ts">
	import { asRecord, firstText } from '$lib/resource-presenter';

	interface ConfigurationField {
		name: string;
		label: string;
		type?: 'text' | 'url' | 'number' | 'textarea';
	}

	let {
		application,
		configurationFields,
		title,
		fields
	}: {
		application: unknown;
		configurationFields: ReadonlyArray<ConfigurationField>;
		title: string;
		fields: readonly string[];
	} = $props();

	const record = $derived(asRecord(application));
	const visibleFields = $derived(
		configurationFields.filter((field) => fields.includes(field.name))
	);
</script>

<svelte:head><title>{title} - Warmify</title></svelte:head>

<section class="settings-section">
	<h2>{title}</h2>
	<form method="POST" action="?/save">
		<div class="field-grid">
			{#each visibleFields as field (field.name)}
				<label class:wide={field.type === 'textarea'}>
					{field.label}
					{#if field.type === 'textarea'}
						<textarea name={field.name}>{firstText(record, [field.name])}</textarea>
					{:else}
						<input
							name={field.name}
							type={field.type ?? 'text'}
							value={firstText(record, [field.name])}
						/>
					{/if}
				</label>
			{/each}
		</div>
		<button class="primary" type="submit">Save {title.toLowerCase()}</button>
	</form>
</section>
