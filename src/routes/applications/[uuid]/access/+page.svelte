<script lang="ts">
	import { resolve } from '$app/paths';
	import { asRecord, firstText } from '$lib/resource-presenter';

	let { data } = $props();
	const application = $derived(asRecord(data.application));
	const destination = $derived(asRecord(application?.destination));
	const domainCount = $derived(
		firstText(application, ['fqdn', 'domains'])
			.split(',')
			.map((domain) => domain.trim())
			.filter(Boolean).length
	);
	const network = $derived(
		firstText(destination, ['network']) ||
			firstText(application, ['destination_network', 'docker_network']) ||
			'None'
	);
	const exposedPorts = $derived(firstText(application, ['ports_exposes']) || 'None');
	const portMappings = $derived(firstText(application, ['ports_mappings']) || 'None');
	const aliases = $derived(firstText(application, ['custom_network_aliases']) || 'None');
	const basePath = $derived(`/applications/${encodeURIComponent(data.uuid)}`);
</script>

<svelte:head><title>Access - Warmify</title></svelte:head>

<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Public access</h2>
			<p class="muted">Domains, redirects, and HTTPS behavior.</p>
		</div>
		<a class="button" href={resolve(`${basePath}/domains` as '/')}>Manage domains</a>
	</div>
	<p>
		<strong>{domainCount} configured {domainCount === 1 ? 'domain' : 'domains'}</strong>
	</p>
</section>

<section class="settings-section">
	<div class="section-heading">
		<div>
			<h2>Internal access</h2>
			<p class="muted">Values available from the public application API.</p>
		</div>
		<a class="button" href={resolve(`${basePath}/networking` as '/')}>Edit networking</a>
	</div>
	<dl class="overview">
		<dt>Internal hostname</dt>
		<dd>Unavailable through the public API</dd>
		<dt>Docker network</dt>
		<dd>{network}</dd>
		<dt>Exposed ports</dt>
		<dd>{exposedPorts}</dd>
		<dt>Port mappings</dt>
		<dd>{portMappings}</dd>
		<dt>Network aliases</dt>
		<dd>{aliases}</dd>
	</dl>
	<p class="muted">
		Internal hostnames are only reachable by resources connected to this Docker network. Coolify
		computes the active hostname from its running-container state, which its public API does not
		expose.
	</p>
</section>
