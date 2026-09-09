<script lang="ts">
	import HierarchySettings from '$lib/components/HierarchySettings.svelte';
	import SharedVariables from '$lib/components/SharedVariables.svelte';
	let { data, form } = $props();
</script>

<HierarchySettings {data}><SharedVariables {data} {form} /></HierarchySettings>
