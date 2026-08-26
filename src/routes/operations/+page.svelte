<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const title = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
</script>

<h1>API operations</h1>
<p>
	This catalogue is the frozen, allowlisted Coolify API surface. Warmify never accepts arbitrary
	upstream paths.
</p>
<ul>
	{#each data.groups as group (group.name)}
		<li>
			<a href={resolve('/operations/[group]', { group: group.name })}
				>{title(group.name)} operations</a
			>
			({group.count})
		</li>
	{/each}
</ul>
