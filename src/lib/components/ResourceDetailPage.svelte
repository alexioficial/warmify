<script lang="ts">
	import AdditionalData from '$lib/components/AdditionalData.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import EnvironmentTable from '$lib/components/EnvironmentTable.svelte';
	import LogViewer from '$lib/components/LogViewer.svelte';
	import RevealSecret from '$lib/components/RevealSecret.svelte';
	import { onMount } from 'svelte';
	import { additionalData, asRecord, firstText, resourceSummary } from '$lib/resource-presenter';

	interface ConfigurationField {
		name: string;
		label: string;
		type?: 'text' | 'url' | 'number' | 'textarea' | 'checkbox' | 'password' | 'select';
		section?: string;
		coerce?: 'boolean' | 'integer' | 'base64' | 'json';
		nullable?: boolean;
		sensitive?: boolean;
		min?: number;
		max?: number;
		options?: ReadonlyArray<{ value: string; label: string }>;
	}

	interface ResourceDetailData {
		group: string;
		uuid: string;
		configurationFields: ReadonlyArray<ConfigurationField>;
		data: unknown;
		related: Record<string, unknown>;
		requestError?: string;
	}

	const applicationFieldGroups = [
		{ id: 'application-details', title: 'Application details', names: ['name', 'description'] },
		{ id: 'access', title: 'Access', names: ['fqdn'] },
		{
			id: 'build-pipeline',
			title: 'Build pipeline',
			names: [
				'git_repository',
				'git_branch',
				'base_directory',
				'publish_directory',
				'build_pack',
				'install_command',
				'build_command',
				'start_command'
			]
		},
		{ id: 'networking', title: 'Networking', names: ['ports_exposes'] },
		{ id: 'healthcheck', title: 'Healthcheck', names: ['health_check_path'] }
	] as const;

	let {
		data,
		form
	}: { data: ResourceDetailData; form?: { error?: string; message?: string } | null } = $props();
	let activeSection = $state('overview');
	const record = $derived(asRecord(data.data));
	const related = $derived((data.related ?? {}) as Record<string, unknown>);
	const summary = $derived(resourceSummary(data.data, data.group));
	const variableGroups = new Set(['applications', 'services', 'databases', 'servers']);
	const lifecycleGroups = new Set(['applications', 'services', 'databases']);
	const settingsNavGroups = new Set(['applications', 'services', 'databases']);
	const deletableGroups = new Set([
		'applications',
		'services',
		'databases',
		'servers',
		'destinations',
		'storage',
		'security'
	]);
	const configurationGroups = $derived(
		data.group === 'applications'
			? applicationFieldGroups
					.map((group) => ({
						id: group.id,
						title: group.title,
						fields: data.configurationFields.filter((field) =>
							(group.names as readonly string[]).includes(field.name)
						)
					}))
					.filter((group) => group.fields.length > 0)
			: [
					{
						id: 'configuration',
						title: 'Configuration',
						fields: [...data.configurationFields]
					}
				]
	);
	const knownKeys = $derived([
		'uuid',
		'id',
		'name',
		'description',
		'status',
		'health',
		'fqdn',
		'ip',
		'port',
		'user',
		'type',
		'git_repository',
		'git_branch',
		'environment',
		'environment_name',
		'server',
		'server_name',
		'environments',
		'created_at',
		'updated_at',
		'logs',
		...data.configurationFields.map((field) => field.name)
	]);
	const extra = $derived(additionalData(data.data, knownKeys));

	function fieldValue(name: string): string {
		return firstText(record, [name]);
	}

	function nestedValue(name: string): string {
		return firstText(asRecord(record?.[name]), ['name', 'uuid', 'id']);
	}

	function statusClass(status: string): string {
		return `status status-${status.toLowerCase().split(/[ -]/)[0]}`;
	}

	function confirmLifecycle(event: MouseEvent, action: string) {
		if (!window.confirm(`${action.charAt(0).toUpperCase()}${action.slice(1)} ${summary.name}?`)) {
			event.preventDefault();
		}
	}

	function logKind(): string | undefined {
		return {
			applications: 'application-logs',
			services: 'service-logs',
			databases: 'database-logs'
		}[data.group];
	}

	function selectSection(section: string) {
		activeSection = section;
	}

	onMount(() => {
		function syncSection() {
			activeSection = location.hash.slice(1) || 'overview';
		}

		syncSection();
		addEventListener('hashchange', syncSection);
		return () => removeEventListener('hashchange', syncSection);
	});
</script>

<svelte:head><title>{summary.name} - Warmify</title></svelte:head>

<div class="resource-heading page-header">
	<div>
		<h1>{summary.name}</h1>
		<div class="actions">
			<span class={statusClass(summary.status)}>{summary.status}</span>
			{#if summary.description}<span class="muted">{summary.description}</span>{/if}
		</div>
	</div>
	{#if lifecycleGroups.has(data.group)}
		<div class="actions">
			<form class="action-form" method="POST" action="?/lifecycle">
				<button name="action" value="start">Start</button>
				{#if data.group === 'applications'}<button class="primary" name="action" value="deploy"
						>Deploy</button
					>{/if}
			</form>
			<form class="action-form" method="POST" action="?/lifecycle">
				<input type="hidden" name="confirmation" value="confirm" />
				<button
					name="action"
					value="restart"
					onclick={(event) => confirmLifecycle(event, 'restart')}>Restart</button
				>
				<button name="action" value="stop" onclick={(event) => confirmLifecycle(event, 'stop')}
					>Stop</button
				>
			</form>
		</div>
	{/if}
</div>

{#if data.requestError}<p class="error" role="alert">{data.requestError}</p>{/if}
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

{#if record}
	<div class:resource-layout={settingsNavGroups.has(data.group)}>
		{#if settingsNavGroups.has(data.group)}
			<nav class="resource-nav" aria-label="Resource settings">
				<p class="nav-heading">- Settings -</p>
				<a
					href="#overview"
					aria-current={activeSection === 'overview' ? 'location' : undefined}
					onclick={() => selectSection('overview')}>General</a
				>
				{#each configurationGroups as group (group.id)}
					<a
						href={`#${group.id}`}
						aria-current={activeSection === group.id ? 'location' : undefined}
						onclick={() => selectSection(group.id)}>{group.title}</a
					>
				{/each}
				{#if variableGroups.has(data.group)}<a
						href="#variables"
						aria-current={activeSection === 'variables' ? 'location' : undefined}
						onclick={() => selectSection('variables')}>Environment variables</a
					>{/if}
				{#if related.storages}<a
						href="#storage"
						aria-current={activeSection === 'storage' ? 'location' : undefined}
						onclick={() => selectSection('storage')}>Persistent storage</a
					>{/if}
				{#if related.tasks}<a
						href="#tasks"
						aria-current={activeSection === 'tasks' ? 'location' : undefined}
						onclick={() => selectSection('tasks')}>Scheduled tasks</a
					>{/if}
				<p class="nav-heading">- Observe & troubleshoot -</p>
				{#if related.deployments}<a
						href="#deployments"
						aria-current={activeSection === 'deployments' ? 'location' : undefined}
						onclick={() => selectSection('deployments')}>Deployments</a
					>{/if}
				{#if related.logs !== undefined || record.logs}<a
						href="#logs"
						aria-current={activeSection === 'logs' ? 'location' : undefined}
						onclick={() => selectSection('logs')}>Runtime logs</a
					>{/if}
			</nav>
		{/if}

		<div class="resource-content">
			<section id="overview">
				<h2>General</h2>
				<dl class="overview">
					<dt>UUID</dt>
					<dd><code>{data.uuid}</code></dd>
					<dt>Type</dt>
					<dd>{summary.type}</dd>
					<dt>Status</dt>
					<dd><span class={statusClass(summary.status)}>{summary.status}</span></dd>
					{#if fieldValue('fqdn')}<dt>Domains</dt>
						<dd>{fieldValue('fqdn')}</dd>{/if}
					{#if fieldValue('git_repository')}<dt>Repository</dt>
						<dd>{fieldValue('git_repository')}</dd>{/if}
					{#if fieldValue('git_branch')}<dt>Branch</dt>
						<dd>{fieldValue('git_branch')}</dd>{/if}
					{#if nestedValue('environment') || fieldValue('environment_name')}<dt>Environment</dt>
						<dd>{nestedValue('environment') || fieldValue('environment_name')}</dd>{/if}
					{#if nestedValue('server') || fieldValue('server_name')}<dt>Server</dt>
						<dd>{nestedValue('server') || fieldValue('server_name')}</dd>{/if}
					{#if fieldValue('ip')}<dt>Address</dt>
						<dd>
							{fieldValue('user') ? `${fieldValue('user')}@` : ''}{fieldValue('ip')}{fieldValue(
								'port'
							)
								? `:${fieldValue('port')}`
								: ''}
						</dd>{/if}
				</dl>
			</section>

			{#if data.group === 'services'}
				<section>
					<h2>Service resources</h2>
					<h3>Applications</h3>
					<DataTable data={related.applications} detailGroup="applications" />
					<h3>Databases</h3>
					<DataTable data={related.databases} detailGroup="databases" />
				</section>
			{:else if data.group === 'servers'}
				<section>
					<h2>Resources</h2>
					<DataTable data={related.resources} />
					{#if related.domains}<h3>Domains</h3>
						<DataTable data={related.domains} />{/if}
				</section>
			{/if}

			{#if data.configurationFields.length}
				<form method="POST" action="?/save">
					{#each configurationGroups as group (group.id)}
						<section class="settings-section" id={group.id}>
							<h2>{group.title}</h2>
							<div class="field-grid">
								{#each group.fields as field (field.name)}
									<label class:wide={field.type === 'textarea'}>
										{field.label}
										{#if field.type === 'textarea'}
											<textarea name={field.name}>{fieldValue(field.name)}</textarea>
										{:else}
											<input
												name={field.name}
												type={field.type ?? 'text'}
												value={fieldValue(field.name)}
											/>
										{/if}
									</label>
								{/each}
							</div>
						</section>
					{/each}
					<button class="primary" type="submit">Save configuration</button>
				</form>
			{/if}

			{#if variableGroups.has(data.group)}
				<section id="variables">
					<div class="section-heading">
						<h2>Environment variables</h2>
						<RevealSecret
							operationId={`GET:/${data.group}/{uuid}/envs`}
							parameters={{ uuid: data.uuid }}
						/>
					</div>
					<EnvironmentTable data={related.variables} />
					<details>
						<summary>Add variable</summary>
						<form method="POST" action="?/createVariable">
							<label>Key <input name="key" required /></label>
							<label>Value <textarea name="value" required></textarea></label>
							<div class="inline-list">
								<label><input type="checkbox" name="is_build_time" /> Build time</label>
								<label><input type="checkbox" name="is_preview" /> Preview</label>
								<label><input type="checkbox" name="is_literal" /> Literal</label>
								<label><input type="checkbox" name="is_multiline" /> Multiline</label>
							</div>
							<button class="primary" type="submit">Add variable</button>
						</form>
					</details>
				</section>
			{/if}

			{#if related.deployments}
				<section id="deployments">
					<h2>Deployments</h2>
					<DeploymentTable data={related.deployments} />
				</section>
			{/if}

			{#if related.logs !== undefined || record.logs}
				<section id="logs">
					<h2>Runtime logs</h2>
					<LogViewer
						initial={related.logs ?? record.logs}
						url={logKind()
							? `/internal/poll/${logKind()}/${encodeURIComponent(data.uuid)}`
							: undefined}
					/>
				</section>
			{/if}

			{#if related.storages}
				<section id="storage">
					<h2>Persistent storage</h2>
					<DataTable data={related.storages} />
				</section>
			{/if}
			{#if related.backups}
				<section>
					<h2>Backups</h2>
					<DataTable data={related.backups} />
				</section>
			{/if}
			{#if related.tasks}
				<section id="tasks">
					<h2>Scheduled tasks</h2>
					<DataTable data={related.tasks} />
				</section>
			{/if}

			<AdditionalData data={extra} />

			{#if deletableGroups.has(data.group)}
				<details>
					<summary class="danger">Delete resource</summary>
					<p class="danger">
						This cannot be undone. Type <strong>{summary.name || data.uuid}</strong> exactly.
					</p>
					<form method="POST" action="?/deleteResource">
						<label>Confirmation <input name="confirmation" required /></label>
						<button type="submit">Delete {summary.type.toLowerCase()}</button>
					</form>
				</details>
			{/if}
		</div>
	</div>
{/if}
