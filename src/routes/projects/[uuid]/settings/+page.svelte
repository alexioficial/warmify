<script lang="ts">
	import HierarchySettings from '$lib/components/HierarchySettings.svelte';
	let { data, form } = $props();
</script>

<HierarchySettings {data} {form} />
