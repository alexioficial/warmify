<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let { url }: { url: string } = $props();
	let privateKey = $state('');
	let message = $state('');
	let busy = $state(false);
	let ready = $state(false);
	let controller: AbortController | undefined;
	let sequence = 0;

	onMount(() => (ready = true));
	onDestroy(() => {
		sequence++;
		controller?.abort();
	});

	function hide() {
		sequence++;
		controller?.abort();
		privateKey = '';
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
				body: '{}',
				signal: controller.signal,
				cache: 'no-store'
			});
			const result = await response.json();
			if (!response.ok || typeof result.privateKey !== 'string')
				throw new Error(result.message ?? 'Private key material is unavailable.');
			if (current === sequence) privateKey = result.privateKey;
		} catch (caught) {
			if (current === sequence && !(caught instanceof DOMException && caught.name === 'AbortError'))
				message = caught instanceof Error ? caught.message : 'Private key material is unavailable.';
		} finally {
			if (current === sequence) busy = false;
		}
	}
</script>

{#if privateKey}
	<textarea rows="12" readonly aria-label="Revealed private key">{privateKey}</textarea>
	<button type="button" onclick={hide}>Hide private key</button>
{:else}
	<p class="muted">Private key material stays hidden until explicitly requested.</p>
	<button type="button" onclick={reveal} disabled={!ready || busy}
		>{busy ? 'Revealing…' : 'Reveal private key'}</button
	>
{/if}
{#if message}<p class="error" role="alert">{message}</p>{/if}
