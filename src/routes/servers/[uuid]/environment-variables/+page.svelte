<script lang="ts">
	import SharedVariables from '$lib/components/SharedVariables.svelte';
	let { data, form } = $props();
</script>

<SharedVariables {data} {form} />
