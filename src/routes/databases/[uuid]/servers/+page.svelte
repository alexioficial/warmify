<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Database servers - Warmify</title></svelte:head>
<section class="settings-section">
	<h2>Servers</h2>
	<dl>
		<dt>Server</dt>
		<dd>{data.overview?.server}</dd>
		<dt>Destination</dt>
		<dd>{data.overview?.destination}</dd>
	</dl>
</section>
