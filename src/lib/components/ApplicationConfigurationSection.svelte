<script lang="ts">
	import { untrack } from 'svelte';
	import { asRecord } from '$lib/resource-presenter';

	interface ConfigurationField {
		name: string;
		label: string;
		type?: 'text' | 'url' | 'number' | 'textarea' | 'checkbox' | 'password' | 'select';
		section?: string;
		sensitive?: boolean;
		min?: number;
		max?: number;
		options?: ReadonlyArray<{ value: string; label: string }>;
	}
	interface ActionResult {
		section?: string;
		values?: Record<string, string | boolean>;
		fieldErrors?: Record<string, string>;
	}

	let {
		application,
		configurationFields,
		title,
		section,
		fields = [],
		form = null
	}: {
		application: unknown;
		configurationFields: ReadonlyArray<ConfigurationField>;
		title: string;
		section?: string;
		fields?: readonly string[];
		form?: ActionResult | null;
	} = $props();

	const record = $derived(asRecord(application));
	const settings = $derived(asRecord(record?.settings));
	const visibleFields = $derived(
		configurationFields.filter((field) =>
			section ? field.section === section : fields.includes(field.name)
		)
	);
	const effectiveSection = $derived(
		section ?? visibleFields[0]?.section ?? title.toLowerCase().replaceAll(' ', '-')
	);
	const submittedValues = $derived(form?.section === effectiveSection ? (form.values ?? {}) : {});
	const fieldErrors = $derived(form?.section === effectiveSection ? (form.fieldErrors ?? {}) : {});

	function rawValue(field: ConfigurationField): unknown {
		if (field.sensitive) return '';
		if (Object.hasOwn(submittedValues, field.name)) return submittedValues[field.name];
		return record?.[field.name] ?? settings?.[field.name] ?? '';
	}

	function textValue(field: ConfigurationField): string {
		const value = rawValue(field);
		if (field.name === 'docker_compose_domains' && Array.isArray(value)) {
			return JSON.stringify(value, null, 2);
		}
		return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
	}

	function checked(field: ConfigurationField): boolean {
		const value = rawValue(field);
		return value === true || value === 1 || value === '1' || value === 'true';
	}

	let textDrafts = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(visibleFields.map((field) => [field.name, textValue(field)])))
	);
	let booleanDrafts = $state<Record<string, boolean>>(
		untrack(() => Object.fromEntries(visibleFields.map((field) => [field.name, checked(field)])))
	);
</script>

<svelte:head><title>{title} - Warmify</title></svelte:head>

<section class="settings-section">
	<h2>{title}</h2>
	<form method="POST" action="?/save">
		<input type="hidden" name="_section" value={effectiveSection} />
		<div class="field-grid">
			{#each visibleFields as field (field.name)}
				<label
					class:wide={field.type === 'textarea'}
					class:checkbox-field={field.type === 'checkbox'}
				>
					{field.label}
					{#if field.type === 'textarea'}
						<textarea
							name={field.name}
							bind:value={textDrafts[field.name]}
							aria-invalid={fieldErrors[field.name] ? 'true' : undefined}
							aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
						></textarea>
					{:else if field.type === 'checkbox'}
						<input type="hidden" name={field.name} value="false" />
						<input
							name={field.name}
							type="checkbox"
							value="true"
							bind:checked={booleanDrafts[field.name]}
							aria-invalid={fieldErrors[field.name] ? 'true' : undefined}
							aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
						/>
					{:else if field.type === 'select'}
						<select
							name={field.name}
							bind:value={textDrafts[field.name]}
							aria-invalid={fieldErrors[field.name] ? 'true' : undefined}
							aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
						>
							{#each field.options ?? [] as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					{:else}
						<input
							name={field.name}
							type={field.type ?? 'text'}
							bind:value={textDrafts[field.name]}
							min={field.min}
							max={field.max}
							autocomplete={field.sensitive ? 'new-password' : undefined}
							placeholder={field.sensitive ? 'Leave blank to keep the current value' : undefined}
							aria-invalid={fieldErrors[field.name] ? 'true' : undefined}
							aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
						/>
					{/if}
					{#if fieldErrors[field.name]}
						<span class="error" id={`${field.name}-error`}>{fieldErrors[field.name]}</span>
					{/if}
				</label>
			{/each}
		</div>
		<button class="primary" type="submit">Save {title.toLowerCase()}</button>
	</form>
</section>
