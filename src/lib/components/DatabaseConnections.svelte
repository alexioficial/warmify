<script lang="ts">
	import { onDestroy } from 'svelte';
	let { uuid }: { uuid: string } = $props();
	let credentials = $state<Array<{ label: string; value: string }> | null>(null);
	let message = $state('');
	let busy = $state(false);
	let controller: AbortController | undefined;
	onDestroy(() => controller?.abort());
	async function reveal() {
		controller?.abort();
		controller = new AbortController();
		busy = true;
		message = '';
		try {
			const response = await fetch(`/internal/databases/${encodeURIComponent(uuid)}/credentials`, {
				method: 'POST',
				signal: controller.signal
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? 'Reveal failed');
			credentials = result.credentials;
		} catch (caught) {
			if (!(caught instanceof DOMException && caught.name === 'AbortError'))
				message = caught instanceof Error ? caught.message : 'Reveal failed';
		} finally {
			busy = false;
		}
	}
</script>

<section class="settings-section">
	<h2>Connection details</h2>
	<p class="muted">
		Connection URLs and stored credentials are hidden until you explicitly reveal them.
	</p>
	<button type="button" onclick={reveal} disabled={busy}
		>{busy ? 'Revealing…' : 'Reveal connection details'}</button
	>
	{#if credentials !== null}
		<button type="button" onclick={() => (credentials = null)}>Hide connection details</button>
		{#if !credentials.length}<p class="muted">
				Coolify did not return connection credentials for this token.
			</p>{/if}
		<dl>
			{#each credentials as credential (credential.label)}<dt>{credential.label}</dt>
				<dd><code>{credential.value}</code></dd>{/each}
		</dl>
	{/if}
	{#if message}<p class="error" role="alert">{message}</p>{/if}
</section>
