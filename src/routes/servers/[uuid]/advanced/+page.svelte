<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	let { data } = $props();
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<h2>Advanced</h2>
<p class="muted">
	Control deployment capacity, timeouts, disk notifications and dashboard terminal access for this
	server.
</p>
<form method="POST" action="?/updateAdvanced" use:enhance>
	<fieldset disabled={!ready}>
		<legend>Builds</legend>
		<div class="form-grid">
			<label
				>Concurrent builds<input
					name="concurrent_builds"
					type="number"
					min="1"
					value={data.server.concurrentBuilds ?? 1}
					required
				/></label
			>
			<label
				>Deployment timeout (seconds)<input
					name="dynamic_timeout"
					type="number"
					min="1"
					value={data.server.dynamicTimeout ?? 3600}
					required
				/></label
			>
			<label
				>Deployment queue limit<input
					name="deployment_queue_limit"
					type="number"
					min="1"
					value={data.server.deploymentQueueLimit ?? 25}
					required
				/></label
			>
		</div>
	</fieldset>
	<fieldset disabled={!ready}>
		<legend>Disk usage</legend>
		<div class="form-grid">
			<label
				>Check frequency<input
					name="server_disk_usage_check_frequency"
					value={data.server.diskUsageFrequency || '0 23 * * *'}
					maxlength="255"
					required
				/></label
			>
			<label
				>Notification threshold (%)<input
					name="server_disk_usage_notification_threshold"
					type="number"
					min="1"
					max="100"
					value={data.server.diskUsageThreshold ?? 80}
					required
				/></label
			>
		</div>
	</fieldset>
	<fieldset disabled={!ready}>
		<legend>Access and role</legend>
		<label
			>SSH connection timeout (seconds)<input
				name="connection_timeout"
				type="number"
				min="1"
				max="300"
				value={data.server.connectionTimeout ?? 10}
				required
			/></label
		>
		<input type="hidden" name="is_build_server" value="false" />
		<label class="checkbox-field">
			<input
				type="checkbox"
				name="is_build_server"
				value="true"
				checked={data.server.isBuildServer}
			/>
			Use as a dedicated build server. Coolify refuses this conversion while managed resources remain.
		</label>
		<input type="hidden" name="is_terminal_enabled" value="false" />
		<label class="checkbox-field">
			<input
				type="checkbox"
				name="is_terminal_enabled"
				value="true"
				checked={data.server.isTerminalEnabled}
			/>
			Allow dashboard terminal access for this server and its containers.
		</label>
	</fieldset>
	<button class="primary" disabled={!ready}>Save advanced settings</button>
</form>
