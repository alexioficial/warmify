<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { DeploymentDraft, DeploymentOutcome } from '$lib/server/deployment-actions';
	let {
		form = null
	}: {
		form?: {
			values?: DeploymentDraft;
			fieldErrors?: Record<string, string>;
			error?: string;
			message?: string;
			outcomes?: DeploymentOutcome[];
			uncertain?: boolean;
			tagRequest?: boolean;
			retryAfterSeconds?: number;
		} | null;
	} = $props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let mode = $state(untrack(() => (form?.values?.mode === 'tag' ? 'tag' : 'uuid')));
	let targets = $state(untrack(() => form?.values?.targets ?? ''));
	let force = $state(untrack(() => form?.values?.force ?? false));
	let preview = $state(untrack(() => form?.values?.pull_request_id ?? ''));
	let dockerTag = $state(untrack(() => form?.values?.docker_tag ?? ''));
	const outcomeText = {
		reference: 'Deployment reference returned — open it to confirm status.',
		started: 'Start reported by Coolify — verify the resource is running.',
		skipped: 'Skipped by Coolify.',
		rejected: 'Rejected or not found by Coolify.',
		unconfirmed: 'No deployment reference or confirmed start returned.',
		missing: 'No result returned for this resource.'
	};
</script>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.uncertain}<p role="alert">
		Some resources may already have started. Check active deployments and resource status before
		submitting again. Warmify has not retried the request.
	</p>{/if}
{#if form?.retryAfterSeconds}<p class="muted">
		Coolify requested a retry delay of {form.retryAfterSeconds} seconds.
	</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}
{#if form?.outcomes}
	<section aria-label="Deployment results">
		<h2>Results</h2>
		{#if form.tagRequest}<p class="muted">
				Tags select applications and services, not databases. Services and skipped targets may have
				no deployment reference. Check their status separately.
			</p>{/if}
		{#if form.outcomes.length}
			<div class="table-wrap">
				<table>
					<thead><tr><th>Resource UUID</th><th>Result</th><th>Deployment</th></tr></thead><tbody>
						{#each form.outcomes as row, index (`${row.resourceUuid}:${index}`)}<tr>
								<td>{row.resourceUuid}</td><td>{outcomeText[row.outcome]}</td>
								<td
									>{#if row.deploymentUuid}<a
											href={resolve('/deployments/[uuid]', { uuid: row.deploymentUuid })}
											>{row.deploymentUuid}</a
										>{:else}—{/if}</td
								>
							</tr>{/each}
					</tbody>
				</table>
			</div>
		{:else}<p>
				No deployment references returned. Check the selected resources before deploying again.
			</p>{/if}
	</section>
{/if}

<form method="POST" class="new-resource-form">
	<fieldset>
		<legend>Targets</legend>
		<div class="field-grid">
			<label
				><span id="deployment-selection-label">Selection</span><select
					name="mode"
					aria-labelledby="deployment-selection-label"
					bind:value={mode}
					disabled={!ready}
					onchange={() => {
						preview = '';
						dockerTag = '';
					}}><option value="uuid">Resource UUIDs</option><option value="tag">Tags</option></select
				></label
			>
			<label
				>Targets (comma-separated)<input
					name="targets"
					bind:value={targets}
					disabled={!ready}
					required
				/></label
			>
		</div>
		<p class="muted">
			UUIDs identify applications, services or databases — not deployments. Tags may select several
			resources. Services and databases are started rather than given application deployment
			histories.
		</p>
	</fieldset>
	<fieldset>
		<legend>Build options</legend>
		<label class="checkbox-field"
			><input type="hidden" name="force" value="false" /><input
				type="checkbox"
				name="force"
				value="true"
				bind:checked={force}
				disabled={!ready}
			/>Force rebuild (without cache)</label
		>
		{#if mode === 'uuid'}<div class="field-grid">
				<label
					>Preview pull request ID<input
						name="pull_request_id"
						inputmode="numeric"
						pattern="[0-9]+"
						bind:value={preview}
						disabled={!ready}
					/></label
				>
				<label
					>Docker preview tag<input
						name="docker_tag"
						bind:value={dockerTag}
						disabled={!ready}
					/></label
				>
			</div>
			<p class="muted">
				Leave preview fields blank for a normal deployment. Docker preview tags require a positive
				preview ID and a Docker Image application. Other previews must already exist in Coolify.
			</p>{/if}
	</fieldset>
	{#if form?.fieldErrors}<ul class="error" role="alert">
			{#each Object.entries(form.fieldErrors) as [field, message] (field)}<li>{message}</li>{/each}
		</ul>{/if}
	<p class="muted">
		Multi-resource deployment is not atomic: an error may occur after some resources start. No
		automatic retries are performed.
	</p>
	<label class="checkbox-field"
		><input type="checkbox" name="confirmation" value="confirm" required disabled={!ready} />I
		confirm these resources may be deployed or started.</label
	>
	<button class="primary" disabled={!ready}>Deploy selected resources</button>
</form>
