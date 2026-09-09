<script lang="ts">
	import { onMount } from 'svelte';
	import { logText } from '$lib/resource-presenter';

	interface PollFailure {
		message: string;
		status?: number;
		retryAfterSeconds?: number;
		retryable?: boolean;
	}

	let {
		initial,
		url,
		initialError,
		interval = 5000
	}: {
		initial: unknown;
		url?: string;
		initialError?: PollFailure;
		interval?: number;
	} = $props();
	function initialFailureValue() {
		return initialError;
	}
	let refreshed = $state<{ value: unknown }>();
	let failure = $state<PollFailure | undefined>(initialFailureValue());
	let ready = $state(false);
	let refreshing = $state(false);
	let lines = $state(100);
	let showTimestamps = $state(false);
	let requestRefresh: (() => void) | undefined;
	const data = $derived(refreshed ? refreshed.value : initial);
	const logs = $derived(logText(data));

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
					: `Runtime log refresh failed (${status})`,
			status,
			...(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
			retryable: status === 429 || status >= 500
		};
	}

	function controlsChanged() {
		failure = undefined;
		requestRefresh?.();
	}

	onMount(() => {
		const endpoint = String(url ?? '');
		if (!endpoint) return;
		ready = true;
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
			if (!disposed && !document.hidden && !failure) {
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
				const target = new URL(endpoint, location.href);
				target.searchParams.set('lines', String(lines));
				target.searchParams.set('show_timestamps', String(showTimestamps));
				const response = await fetch(`${target.pathname}${target.search}`, {
					signal: controller.signal
				});
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
						: { message: 'Runtime log refresh failed', status: 500, retryable: true };
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
			} else if (!failure) {
				void refresh();
			}
		}

		requestRefresh = () => {
			failure = undefined;
			void refresh();
		};
		document.addEventListener('visibilitychange', visibilityChanged);
		schedule();

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

{#if url}
	<div class="log-toolbar">
		<label>
			Lines
			<select bind:value={lines} onchange={controlsChanged} disabled={!ready}>
				<option value={50}>50</option>
				<option value={100}>100</option>
				<option value={250}>250</option>
				<option value={500}>500</option>
				<option value={1000}>1000</option>
			</select>
		</label>
		<label class="checkbox-field">
			<input
				type="checkbox"
				bind:checked={showTimestamps}
				onchange={controlsChanged}
				disabled={!ready}
			/>
			Show timestamps
		</label>
		<button type="button" onclick={() => requestRefresh?.()} disabled={!ready || refreshing}>
			{refreshing ? 'Refreshing...' : 'Refresh now'}
		</button>
	</div>
{/if}

{#if failure}
	<div class="poll-error" role="alert">
		<p>{failure.message}</p>
		{#if failure.status === 429 && failure.retryAfterSeconds}
			<p class="muted">Coolify requested a retry in {failure.retryAfterSeconds} seconds.</p>
		{/if}
		{#if url}
			<button type="button" onclick={() => requestRefresh?.()}>Retry</button>
		{/if}
	</div>
{/if}

{#if logs}
	<pre class="log-output" aria-live="polite">{logs}</pre>
{:else if !failure}
	<p class="muted">No logs available.</p>
{/if}
