<script lang="ts">
	import { onMount } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deploymentSummary } from '$lib/resource-presenter';
	import type { loadDeploymentPage, deploymentSnapshot } from '$lib/server/deployment-detail';
	import type { SubmitFunction } from '@sveltejs/kit';
	let {
		data,
		form
	}: {
		data: Awaited<ReturnType<typeof loadDeploymentPage>>;
		form?: { error?: string; message?: string } | null;
	} = $props();
	let updated = $state<ReturnType<typeof deploymentSnapshot>>();
	const snapshot = $derived(updated ?? data);
	const summary = $derived(deploymentSummary(snapshot.deployment));
	const active = $derived(['queued', 'in_progress'].includes(summary.rawStatus));
	let ready = $state(false);
	let refreshing = $state(false);
	let failure = $state('');
	let retryAfter = $state<number>();
	let requestRefresh: (() => void) | undefined;
	const enhanceCancellation: SubmitFunction =
		() =>
		async ({ result }) => {
			if (result.type === 'redirect') {
				await goto(resolve(result.location as '/'), { invalidateAll: true, replaceState: true });
				return;
			}
			await applyAction(result);
		};
	onMount(() => {
		ready = true;
		const uuid = data.uuid;
		let disposed = false;
		let sequence = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let controller: AbortController | undefined;
		function stopTimer() {
			if (timer) clearTimeout(timer);
			timer = undefined;
		}
		function schedule() {
			stopTimer();
			if (!disposed && !document.hidden && active && !failure)
				timer = setTimeout(() => void refresh(), 5000);
		}
		async function refresh() {
			if (disposed || document.hidden) return;
			stopTimer();
			controller?.abort();
			controller = new AbortController();
			const current = ++sequence;
			refreshing = true;
			try {
				const response = await fetch(`/internal/poll/deployments/${encodeURIComponent(uuid)}`, {
					signal: controller.signal
				});
				const result = await response.json();
				if (disposed || current !== sequence) return;
				if (!response.ok) {
					retryAfter = Number(result.retryAfterSeconds) || undefined;
					throw new Error('Deployment refresh failed. Use Refresh to try again.');
				}
				if (result?.deployment?.deployment_uuid !== uuid || !result.logs)
					throw new Error('Deployment refresh returned an unexpected response.');
				updated = result;
				failure = '';
				retryAfter = undefined;
			} catch (caught) {
				if (
					disposed ||
					current !== sequence ||
					(caught instanceof DOMException && caught.name === 'AbortError')
				)
					return;
				failure = 'Deployment refresh failed. Use Refresh to try again.';
			} finally {
				if (!disposed && current === sequence) {
					refreshing = false;
					schedule();
				}
			}
		}
		function visibilityChanged() {
			if (document.hidden) {
				stopTimer();
				controller?.abort();
				sequence++;
				refreshing = false;
			} else if (active && !failure) void refresh();
		}
		requestRefresh = () => {
			failure = '';
			void refresh();
		};
		document.addEventListener('visibilitychange', visibilityChanged);
		schedule();
		return () => {
			disposed = true;
			sequence++;
			stopTimer();
			controller?.abort();
			requestRefresh = undefined;
			document.removeEventListener('visibilitychange', visibilityChanged);
		};
	});
</script>

<svelte:head><title>{summary.name} deployment - Warmify</title></svelte:head>
<header class="page-header">
	<div>
		<h1>{summary.name}</h1>
		<p class="muted">Deployment {data.uuid}</p>
	</div>
	<a href={resolve('/deployments')}>Active deployments</a>
</header>
{#if data.context.length}<nav class="actions" aria-label="Deployment context">
		{#each data.context as link (link.href)}<a href={resolve(link.href)}>{link.label}</a>{/each}
	</nav>{:else}<p class="muted">Application context is unavailable.</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}
<section class="settings-section" aria-label="Deployment status">
	<h2>Status</h2>
	<dl class="overview">
		<dt>Status</dt>
		<dd data-testid="deployment-status">{summary.status}</dd>
		<dt>Source</dt>
		<dd>{summary.source}</dd>
		<dt>Commit</dt>
		<dd>{summary.commit || '—'}</dd>
		<dt>Message</dt>
		<dd>{summary.message || '—'}</dd>
		<dt>Server</dt>
		<dd>{summary.server || '—'}</dd>
		<dt>Started</dt>
		<dd>{summary.createdAt || '—'}</dd>
		<dt>Finished</dt>
		<dd>{summary.finishedAt || '—'}</dd>
		<dt>Duration</dt>
		<dd>{summary.duration}</dd>
	</dl>
	<button type="button" disabled={!ready || refreshing} onclick={() => requestRefresh?.()}
		>Refresh</button
	>
	{#if refreshing}<p role="status">Refreshing deployment…</p>{/if}
	{#if failure}<p class="error" role="alert">{failure}</p>{/if}
	{#if retryAfter}<p class="muted">Coolify requested a retry delay of {retryAfter} seconds.</p>{/if}
	{#if active}<form method="POST" action="?/cancel" use:enhance={enhanceCancellation}>
			<p>
				Cancellation stops the current build or removes the queued deployment. It does not stop the
				running application.
			</p>
			<label class="checkbox-field"
				><input type="checkbox" name="confirmation" value="confirm" required disabled={!ready} />I
				confirm cancellation of this deployment.</label
			>
			<button class="danger" disabled={!ready}>Cancel deployment</button>
		</form>{:else}<p class="muted">
			This deployment is no longer active. Automatic refresh has stopped.
		</p>{/if}
</section>
<section class="settings-section" aria-label="Deployment logs">
	<h2>Logs</h2>
	{#if !snapshot.logs.available}<p class="muted">
			Logs are unavailable. The API token may not have permission to read sensitive data.
		</p>
	{:else if !snapshot.logs.text}<p class="muted">No visible log output yet.</p>
	{:else}{#if snapshot.logs.truncated}<p class="muted">
				Showing the latest 200,000 characters.
			</p>{/if}
		<pre class="log-output">{snapshot.logs.text}</pre>{/if}
</section>
