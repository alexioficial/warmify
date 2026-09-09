<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	let { url, fields }: { url: string; fields: { key: string; label: string }[] } = $props();
	let ready = $state(false);
	let busy = $state(false);
	let values = $state<Record<string, string | null> | null>(null);
	let message = $state('');
	let controller: AbortController | undefined;
	let sequence = 0;
	onMount(() => {
		ready = true;
	});
	function hide() {
		sequence++;
		controller?.abort();
		values = null;
		message = '';
		busy = false;
	}
	onDestroy(hide);
	async function reveal() {
		hide();
		const current = ++sequence;
		controller = new AbortController();
		busy = true;
		try {
			const response = await fetch(url, {
				method: 'POST',
				cache: 'no-store',
				signal: controller.signal
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message || 'Secrets could not be revealed.');
			if (current !== sequence) return;
			values = Object.fromEntries(
				fields.map(({ key }) => [key, typeof result[key] === 'string' ? result[key] : null])
			);
		} catch (caught) {
			if (current === sequence)
				message = caught instanceof Error ? caught.message : 'Secrets could not be revealed.';
		} finally {
			if (current === sequence) busy = false;
		}
	}
</script>

{#if values}
	<dl>
		{#each fields as field (field.key)}
			<dt>{field.label}</dt>
			<dd><pre>{values[field.key] ?? 'Unavailable'}</pre></dd>
		{/each}
	</dl>
	<button type="button" onclick={hide}>Hide secrets</button>
{:else}
	<button type="button" onclick={reveal} disabled={!ready || busy}
		>{busy ? 'Revealing…' : 'Reveal secrets'}</button
	>
{/if}
{#if message}<p role="alert" class="error">{message}</p>{/if}
