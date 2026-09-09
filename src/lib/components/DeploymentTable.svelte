<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { deploymentSummary, formatRelativeTime, normalizeRecords } from '$lib/resource-presenter';

	interface PollFailure {
		message: string;
		status?: number;
		retryAfterSeconds?: number;
		retryable?: boolean;
	}

	let {
		data: initialData,
		pollUrl,
		initialError,
		interval = 5000,
		pollWhenEmpty = false,
		refreshOnMount = false,
		showApplication = false
	}: {
		data: unknown;
		pollUrl?: string;
		initialError?: PollFailure;
		interval?: number;
		pollWhenEmpty?: boolean;
		refreshOnMount?: boolean;
		showApplication?: boolean;
	} = $props();
	function initialFailureValue() {
		return initialError;
	}
	let refreshed = $state<{ value: unknown }>();
	let failure = $state<PollFailure | undefined>(initialFailureValue());
	let refreshing = $state(false);
	let requestRefresh: (() => void) | undefined;
	const data = $derived(refreshed ? refreshed.value : initialData);
	const deployments = $derived(normalizeRecords(data).map(deploymentSummary));
	const active = $derived(deployments.filter((deployment) => deployment.group === 'active'));
	const queued = $derived(deployments.filter((deployment) => deployment.group === 'queued'));
	const completed = $derived(deployments.filter((deployment) => deployment.group === 'completed'));
	const hasLiveDeployments = $derived(active.length > 0 || queued.length > 0);

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ -]/)[0]}`;
	}

	function pollFailure(payload: unknown, status: number): PollFailure {
		const record =
			payload && typeof payload === 'object' && !Array.isArray(payload)
				? (payload as Record<string, unknown>)
				: undefined;
		const retryAfterSeconds = Number(record?.retryAfterSeconds);
		return {
			message:
				typeof record?.message === 'string'
					? record.message
					: `Deployment refresh failed (${status})`,
			status,
			...(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
			retryable: status === 429 || status >= 500
		};
	}

	onMount(() => {
		const endpoint = String(pollUrl ?? '');
		if (!endpoint) return;
		let disposed = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let controller: AbortController | undefined;
		let requestSequence = 0;

		function clearTimer() {
			if (timer) clearTimeout(timer);
			timer = undefined;
		}

		function schedule() {
			clearTimer();
			if (!disposed && !document.hidden && (hasLiveDeployments || pollWhenEmpty) && !failure) {
				timer = setTimeout(() => void refresh(), interval);
			}
		}

		async function refresh() {
			if (disposed || document.hidden) return;
			clearTimer();
			controller?.abort();
			controller = new AbortController();
			const sequence = ++requestSequence;
			refreshing = true;
			try {
				const response = await fetch(endpoint, { signal: controller.signal });
				const payload = await response.json().catch(() => undefined);
				if (!response.ok) throw pollFailure(payload, response.status);
				if (disposed || sequence !== requestSequence) return;
				refreshed = { value: payload };
				failure = undefined;
			} catch (caught) {
				if (disposed || sequence !== requestSequence) return;
				if (caught instanceof DOMException && caught.name === 'AbortError') return;
				failure =
					caught && typeof caught === 'object' && 'message' in caught
						? (caught as PollFailure)
						: { message: 'Deployment refresh failed', status: 500, retryable: true };
			} finally {
				if (!disposed && sequence === requestSequence) {
					refreshing = false;
					schedule();
				}
			}
		}

		function visibilityChanged() {
			if (document.hidden) {
				clearTimer();
				controller?.abort();
				requestSequence += 1;
				refreshing = false;
			} else if ((hasLiveDeployments || pollWhenEmpty) && !failure) {
				void refresh();
			}
		}

		requestRefresh = () => {
			failure = undefined;
			void refresh();
		};
		document.addEventListener('visibilitychange', visibilityChanged);
		if (refreshOnMount) void refresh();
		else schedule();

		return () => {
			disposed = true;
			requestSequence += 1;
			clearTimer();
			controller?.abort();
			requestRefresh = undefined;
			document.removeEventListener('visibilitychange', visibilityChanged);
		};
	});
</script>

{#if failure}
	<div class="poll-error" role="alert">
		<p>{failure.message}</p>
		{#if failure.status === 429 && failure.retryAfterSeconds}
			<p class="muted">Coolify requested a retry in {failure.retryAfterSeconds} seconds.</p>
		{/if}
		{#if failure.retryable && pollUrl}
			<button type="button" onclick={() => requestRefresh?.()}>Retry</button>
		{/if}
	</div>
{/if}

{#if refreshing}<p class="muted" role="status">Refreshing deployments...</p>{/if}

{#if deployments.length}
	<div class="deployment-groups">
		{#each [{ label: 'Active', rows: active }, { label: 'Queued', rows: queued }, { label: 'Completed', rows: completed }] as group (group.label)}
			{#if group.rows.length}
				<section
					class="deployment-group"
					aria-labelledby={`deployment-${group.label.toLowerCase()}`}
				>
					<h3 id={`deployment-${group.label.toLowerCase()}`}>
						{group.label} <span class="muted">({group.rows.length})</span>
					</h3>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									{#if showApplication}<th>Application</th>{/if}
									<th>Status</th><th>Source</th><th>Commit</th><th>Started</th><th>Duration</th><th
										>Server</th
									>
								</tr>
							</thead>
							<tbody>
								{#each group.rows as deployment, index (deployment.id || index)}
									<tr>
										{#if showApplication}<td
												>{#if deployment.id}<a
														href={resolve('/deployments/[uuid]', { uuid: deployment.id })}
														>{deployment.name}</a
													>{:else}{deployment.name}{/if}</td
											>{/if}
										<td>
											{#if deployment.id}
												<a href={resolve('/deployments/[uuid]', { uuid: deployment.id })}>
													<span class={statusClass(deployment.status)}>{deployment.status}</span>
												</a>
											{:else}
												<span class={statusClass(deployment.status)}>{deployment.status}</span>
											{/if}
										</td>
										<td>
											{#if deployment.id}<a
													href={resolve('/deployments/[uuid]', { uuid: deployment.id })}
													>{deployment.source}</a
												>{:else}{deployment.source}{/if}
										</td>
										<td>
											{#if deployment.id}<a
													href={resolve('/deployments/[uuid]', { uuid: deployment.id })}
												>
													{#if deployment.commit}<code>{deployment.commit.slice(0, 7)}</code>{/if}
													{deployment.message || '-'}
												</a>{:else}{deployment.message || '-'}{/if}
										</td>
										<td>{formatRelativeTime(deployment.createdAt)}</td>
										<td>{deployment.duration}</td>
										<td>{deployment.server || '-'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{/each}
	</div>
{:else if !failure}
	<p class="muted">No deployments found.</p>
{/if}
