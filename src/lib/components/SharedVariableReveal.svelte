<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	let { url, id }: { url: string; id: string } = $props();
	let revealed = $state<{ value: string | null } | null>(null);
	let message = $state('');
	let busy = $state(false);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let controller: AbortController | undefined;
	let sequence = 0;
	onDestroy(() => {
		sequence++;
		controller?.abort();
	});
	function hide() {
		sequence++;
		controller?.abort();
		revealed = null;
		message = '';
		busy = false;
	}
	async function reveal() {
		controller?.abort();
		controller = new AbortController();
		const current = ++sequence;
		busy = true;
		message = '';
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id }),
				signal: controller.signal,
				cache: 'no-store'
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? 'Reveal failed.');
			if (result.value !== null && typeof result.value !== 'string')
				throw new Error('Value unavailable.');
			if (current === sequence) revealed = { value: result.value };
		} catch (caught) {
			if (current === sequence && !(caught instanceof DOMException && caught.name === 'AbortError'))
				message = caught instanceof Error ? caught.message : 'Reveal failed.';
		} finally {
			if (current === sequence) busy = false;
		}
	}
</script>

{#if revealed}
	<code class="shared-value"
		>{revealed.value === null
			? '(null)'
			: revealed.value === ''
				? '(empty string)'
				: revealed.value}</code
	>
	<button type="button" onclick={hide}>Hide value</button>
{:else}
	<span class="muted">Hidden</span>
	<button type="button" onclick={reveal} disabled={busy || !ready}
		>{busy ? 'Revealing…' : 'Reveal value'}</button
	>
{/if}
{#if message}<p class="error" role="alert">{message}</p>{/if}
