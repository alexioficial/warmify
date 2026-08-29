<script lang="ts">
	import { untrack } from 'svelte';

	interface DomainRow {
		url: string;
		noindex: boolean;
	}

	interface DomainState {
		rows: DomainRow[];
		redirect: '' | 'www' | 'non-www' | 'both';
		forceHttps: boolean;
	}

	interface DomainConflict {
		domain: string;
		resourceName: string;
		resourceUuid: string;
		resourceType: string;
		message: string;
	}

	interface DomainActionResult {
		error?: string;
		message?: string;
		fieldError?: string;
		warning?: string;
		conflicts?: DomainConflict[];
		domainRows?: DomainRow[];
		redirect?: DomainState['redirect'];
		forceHttps?: boolean;
		rowErrors?: Record<number, string>;
	}

	let { data, form }: { data: { domainState: DomainState }; form: DomainActionResult | null } =
		$props();
	const actionResult = $derived(form);
	let rows = $state<DomainRow[]>(
		untrack(() => {
			const initialRows = form?.domainRows ?? data.domainState.rows;
			return initialRows.map((row) => ({ ...row }));
		})
	);
	let redirect = $state(untrack(() => form?.redirect ?? data.domainState.redirect));
	let forceHttps = $state(untrack(() => form?.forceHttps ?? data.domainState.forceHttps));

	function addDomain() {
		rows.push({ url: '', noindex: false });
	}

	function removeDomain(index: number) {
		rows.splice(index, 1);
	}
</script>

<svelte:head><title>Domains - Warmify</title></svelte:head>

<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Domains</h2>
			<p class="muted">Configure public URLs and their search-indexing behavior.</p>
		</div>
		<button type="button" onclick={addDomain}>Add domain</button>
	</div>

	<form method="POST" action="?/saveDomains">
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Domain URL</th>
						<th>Keep out of search engines</th>
						<th><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, index (row)}
						<tr>
							<td>
								<label class="visually-hidden" for={`domain-${index}`}>Domain URL</label>
								<input
									id={`domain-${index}`}
									name="domain"
									type="url"
									placeholder="https://example.com"
									bind:value={row.url}
									aria-invalid={actionResult?.rowErrors?.[index] ? 'true' : undefined}
									aria-describedby={actionResult?.rowErrors?.[index]
										? `domain-${index}-error`
										: undefined}
								/>
								{#if actionResult?.rowErrors?.[index]}
									<span class="error" id={`domain-${index}-error`}
										>{actionResult.rowErrors[index]}</span
									>
								{/if}
							</td>
							<td>
								<label class="checkbox-field">
									<input
										type="checkbox"
										name="noindex_index"
										value={index}
										bind:checked={row.noindex}
									/>
									Noindex
								</label>
							</td>
							<td><button type="button" onclick={() => removeDomain(index)}>Remove</button></td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="3" class="muted">No public domains configured.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>

		{#if actionResult?.fieldError}<p class="error">{actionResult.fieldError}</p>{/if}

		<div class="field-grid">
			<label>
				Redirect behavior
				<select name="redirect" bind:value={redirect}>
					<option value="">No redirect</option>
					<option value="www">Redirect to www</option>
					<option value="non-www">Redirect to non-www</option>
					<option value="both">Serve both</option>
				</select>
			</label>
			<label class="checkbox-field">
				<input
					type="checkbox"
					name="is_force_https_enabled"
					value="true"
					bind:checked={forceHttps}
				/>
				Force HTTPS
			</label>
		</div>

		{#if actionResult?.conflicts?.length}
			<section aria-labelledby="domain-conflicts-heading">
				<h3 id="domain-conflicts-heading">Domain conflicts</h3>
				{#if actionResult.warning}<p>{actionResult.warning}</p>{/if}
				<div class="table-wrap">
					<table>
						<thead><tr><th>Domain</th><th>Resource</th><th>Type</th><th>Details</th></tr></thead>
						<tbody>
							{#each actionResult.conflicts as conflict (conflict.domain + conflict.resourceUuid)}
								<tr>
									<td>{conflict.domain}</td>
									<td>{conflict.resourceName || conflict.resourceUuid || '-'}</td>
									<td>{conflict.resourceType || '-'}</td>
									<td>{conflict.message || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<button class="danger" type="submit" name="force_domain_override" value="true"
					>Save despite conflicts</button
				>
			</section>
		{/if}

		<button class="primary" type="submit">Save domains</button>
	</form>
</section>
