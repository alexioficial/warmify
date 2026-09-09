<script lang="ts">
	import { resolve } from '$app/paths';
	import SharedVariables from '$lib/components/SharedVariables.svelte';
	let { data, form } = $props();
</script>

<svelte:head><title>Shared variables - {data.team.name} - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>{data.team.name}</h1>
		<p class="muted">Team-wide configuration inherited by projects and resources.</p>
	</div>
	<a href={resolve(`/teams/${data.team.id}` as '/')}>Members</a>
</div>
<section class="settings-section"><SharedVariables {data} {form} /></section>
