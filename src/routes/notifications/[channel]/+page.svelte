<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));

	const submitted = $derived(form?.values);
	const deliveryToggles = $derived(
		data.definition.toggles.filter((item) => item.section === 'delivery')
	);
	const eventToggles = $derived(
		data.definition.toggles.filter((item) => item.section === 'events')
	);
	const deliveryFields = $derived(
		data.definition.fields.filter((item) => item.section === 'delivery')
	);
	const threadFields = $derived(
		data.definition.fields.filter((item) => item.section === 'threads')
	);
	const fieldErrors = $derived(
		(form && 'fieldErrors' in form ? form.fieldErrors : undefined) as
			Record<string, string> | undefined
	);
	const toggleValue = (name: string) =>
		submitted?.toggles?.[name] ?? data.settings.toggles[name] ?? false;
	const fieldValue = (name: string) =>
		submitted?.fields?.[name] ?? data.settings.fields[name] ?? '';
	const modeValue = (name: string) => submitted?.modes?.[name] ?? 'keep';
</script>

<svelte:head><title>{data.definition.label} notifications - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.definition.label}</h1>
		<p class="muted">{data.definition.description}</p>
	</div>
	<a href={resolve('/notifications')}>All notification channels</a>
</div>
{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

<form method="POST" action="?/update">
	<section class="settings-section">
		<h2>Delivery</h2>
		{#if deliveryToggles.length}
			<div class="checkbox-list">
				{#each deliveryToggles as toggle (toggle.name)}
					<label>
						<input type="hidden" name={toggle.name} value="false" />
						<input
							type="checkbox"
							name={toggle.name}
							value="true"
							checked={toggleValue(toggle.name)}
							disabled={!ready}
						/>
						{toggle.label}
					</label>
				{/each}
			</div>
		{/if}
		<div class="form-grid">
			{#each deliveryFields as field (field.name)}
				{#if field.sensitive}
					<div>
						<label>
							{field.label} stored value
							<select name={`${field.name}_mode`} disabled={!ready}>
								<option value="keep" selected={modeValue(field.name) === 'keep'}>Keep</option>
								<option value="replace" selected={modeValue(field.name) === 'replace'}
									>Replace</option
								>
								<option value="clear" selected={modeValue(field.name) === 'clear'}>Clear</option>
							</select>
						</label>
						<label>
							{field.label} replacement
							<input
								name={field.name}
								type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'password'}
								autocomplete="off"
								maxlength={field.max}
								disabled={!ready}
							/>
						</label>
						<p class="muted">
							{data.settings.configuredSecrets[field.name]
								? 'A value is stored in Coolify.'
								: 'No readable stored value was returned.'}
						</p>
						{#if fieldErrors?.[field.name]}
							<p class="error">{fieldErrors[field.name]}</p>
						{/if}
					</div>
				{:else if field.type === 'select'}
					<label>
						{field.label}
						<select name={field.name} disabled={!ready}>
							<option value="" selected={!fieldValue(field.name)}>System default</option>
							{#each field.options ?? [] as option (option.value)}
								<option value={option.value} selected={fieldValue(field.name) === option.value}
									>{option.label}</option
								>
							{/each}
						</select>
						{#if fieldErrors?.[field.name]}<span class="error">{fieldErrors[field.name]}</span>{/if}
					</label>
				{:else}
					<label>
						{field.label}
						<input
							name={field.name}
							type={field.type}
							value={fieldValue(field.name)}
							min={field.min}
							max={field.max}
							maxlength={field.type === 'number' ? undefined : field.max}
							disabled={!ready}
						/>
						{#if fieldErrors?.[field.name]}<span class="error">{fieldErrors[field.name]}</span>{/if}
					</label>
				{/if}
			{/each}
		</div>
	</section>

	<section class="settings-section">
		<h2>Events</h2>
		<p class="muted">Choose which Coolify events are delivered through this channel.</p>
		<div class="checkbox-list">
			{#each eventToggles as toggle (toggle.name)}
				<label>
					<input type="hidden" name={toggle.name} value="false" />
					<input
						type="checkbox"
						name={toggle.name}
						value="true"
						checked={toggleValue(toggle.name)}
						disabled={!ready}
					/>
					{toggle.label}
				</label>
			{/each}
		</div>
	</section>

	{#if threadFields.length}
		<section class="settings-section">
			<h2>Event thread IDs</h2>
			<p class="muted">
				Optional Telegram topic IDs. Each stored value can be kept, replaced, or cleared.
			</p>
			<div class="form-grid">
				{#each threadFields as field (field.name)}
					<div>
						<label>
							{field.label} stored value
							<select name={`${field.name}_mode`} disabled={!ready}>
								<option value="keep" selected={modeValue(field.name) === 'keep'}>Keep</option>
								<option value="replace" selected={modeValue(field.name) === 'replace'}
									>Replace</option
								>
								<option value="clear" selected={modeValue(field.name) === 'clear'}>Clear</option>
							</select>
						</label>
						<label>
							{field.label} replacement
							<input name={field.name} autocomplete="off" maxlength={field.max} disabled={!ready} />
						</label>
						{#if fieldErrors?.[field.name]}<p class="error">{fieldErrors[field.name]}</p>{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<p class="muted">
		Credential fields are blank by design. Warmify does not cache them or return submitted
		replacements after an error.
	</p>
	<button class="primary" disabled={!ready || Boolean(data.requestError)}
		>Save notification settings</button
	>
</form>
