<script lang="ts">
	import { resolve } from '$app/paths';
	import { NOTIFICATION_CHANNELS } from '$lib/notification-settings';
</script>

<svelte:head><title>Notifications - Warmify</title></svelte:head>
<div class="page-header">
	<div>
		<h1>Notifications</h1>
		<p class="muted">Configure how the current Coolify team receives operational events.</p>
	</div>
</div>
<div class="card-grid">
	{#each NOTIFICATION_CHANNELS as channel (channel.id)}
		<a class="resource-card" href={resolve(`/notifications/${channel.id}` as '/')}>
			<h2>{channel.label}</h2>
			<p>{channel.description}</p>
		</a>
	{/each}
</div>
