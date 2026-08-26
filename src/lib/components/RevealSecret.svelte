<script lang="ts">
	import EnvironmentTable from './EnvironmentTable.svelte';

	let { operationId, parameters }: { operationId: string; parameters: Record<string, string> } =
		$props();
	let value = $state<unknown>(null);
	let error = $state('');

	async function reveal() {
		try {
			const response = await fetch('/internal/reveal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operationId, parameters })
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message ?? `Reveal failed (${response.status})`);
			value = result;
			error = '';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Reveal failed';
		}
	}

	async function copy() {
		await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
	}
</script>

<button type="button" onclick={reveal}>Reveal sensitive response</button>
{#if error}<p class="error">{error}</p>{/if}
{#if value !== null}
	<button type="button" onclick={copy}>Copy revealed response</button>
	{#if operationId.includes('/envs')}<EnvironmentTable data={value} />{:else}<pre>{JSON.stringify(
				value,
				null,
				2
			)}</pre>{/if}
{/if}
