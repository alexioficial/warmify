<script lang="ts">
	import { resolve } from '$app/paths';
	import AdditionalData from '$lib/components/AdditionalData.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import DeploymentTable from '$lib/components/DeploymentTable.svelte';
	import EnvironmentTable from '$lib/components/EnvironmentTable.svelte';
	import LogViewer from '$lib/components/LogViewer.svelte';
	import RevealSecret from '$lib/components/RevealSecret.svelte';
	import {
		additionalData,
		asRecord,
		firstText,
		projectEnvironments,
		resourceSummary
	} from '$lib/resource-presenter';
	import { collectionPath, detailPath } from '$lib/resource-routes';

	interface ResourceDetailData {
		title: string;
		group: string;
		uuid: string;
		configurationFields: ReadonlyArray<{
			name: string;
			label: string;
			type?: 'text' | 'url' | 'number' | 'textarea';
		}>;
		data: unknown;
		related: Record<string, unknown>;
		requestError?: string;
	}

	let {
		data,
		form
	}: { data: ResourceDetailData; form?: { error?: string; message?: string } | null } = $props();
	const record = $derived(asRecord(data.data));
	const related = $derived((data.related ?? {}) as Record<string, unknown>);
	const summary = $derived(resourceSummary(data.data, data.group));
	const environments = $derived(
		projectEnvironments({ environments: related.environments ?? record?.environments })
	);
	const variableGroups = new Set(['projects', 'applications', 'services', 'databases', 'servers']);
	const lifecycleGroups = new Set(['applications', 'services', 'databases']);
	const deletableGroups = new Set([
		'projects',
		'applications',
		'services',
		'databases',
		'servers',
		'destinations',
		'storage',
		'security'
	]);
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
		return `status status-${status.toLowerCase().split(/[ ·]/)[0]}`;
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
</script>

<p>
	<a href={resolve('/')}>Dashboard</a> /
	<a href={resolve(collectionPath(data.group) ?? '/')}>{data.title}</a> /
</p>
<div class="resource-heading">
	<div>
		<h1>{summary.name}</h1>
		{#if summary.description}<p>{summary.description}</p>{/if}
	</div>
	{#if lifecycleGroups.has(data.group)}
		<div class="actions">
			<form class="action-form" method="POST" action="?/lifecycle">
				<button name="action" value="start">Start</button>
				{#if data.group === 'applications'}<button name="action" value="deploy">Deploy</button>{/if}
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
	<nav class="resource-nav" aria-label="Resource sections">
		<a href="#overview">Overview</a>
		{#if data.group === 'projects'}<a href="#environments">Environments</a>{/if}
		{#if data.configurationFields.length}<a href="#configuration">Configuration</a>{/if}
		{#if variableGroups.has(data.group)}<a href="#variables">Environment variables</a>{/if}
		{#if related.deployments}<a href="#deployments">Deployments</a>{/if}
		{#if related.logs !== undefined || record.logs}<a href="#logs">Logs</a>{/if}
		{#if related.storages}<a href="#storage">Storage</a>{/if}
	</nav>

	<section id="overview">
		<h2>Overview</h2>
		<dl class="overview">
			<dt>UUID</dt>
			<dd><code>{data.uuid}</code></dd>
			<dt>Type</dt>
			<dd>{summary.type}</dd>
			<dt>Status</dt>
			<dd class={statusClass(summary.status)}>{summary.status}</dd>
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
					{fieldValue('user') ? `${fieldValue('user')}@` : ''}{fieldValue('ip')}{fieldValue('port')
						? `:${fieldValue('port')}`
						: ''}
				</dd>{/if}
		</dl>
	</section>

	{#if data.group === 'projects'}
		<section id="environments">
			<div class="section-heading">
				<h2>Environments</h2>
				<div class="actions">
					<a href={resolve(`/projects/${encodeURIComponent(data.uuid)}/new`)}>Create resource</a>
					<details>
						<summary>Add environment</summary>
						<form method="POST" action="?/createEnvironment">
							<label>Name <input name="name" placeholder="production" required /></label>
							<label>Description <textarea name="description"></textarea></label>
							<button type="submit">Create environment</button>
						</form>
					</details>
				</div>
			</div>
			{#each environments as environment (environment.id)}
				<h3>{environment.name}</h3>
				{#if environment.description}<p>{environment.description}</p>{/if}
				{#if environment.resources.length}
					<ul class="resource-list">
						{#each environment.resources as resource (resource.id)}
							<li>
								<a
									href={resolve(
										detailPath(resource.group, resource.id) ?? collectionPath(resource.group) ?? '/'
									)}><strong>{resource.name}</strong></a
								>
								— {resource.type} —
								<span class={statusClass(resource.status)}>{resource.status}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">No resources in this environment.</p>
				{/if}
			{:else}
				<p class="muted">No environments found.</p>
			{/each}
		</section>
	{/if}

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

	{#if related.deployments}
		<section id="deployments">
			<h2>Deployments</h2>
			<DeploymentTable data={related.deployments} />
		</section>
	{/if}

	{#if data.configurationFields.length}
		<section id="configuration">
			<h2>Configuration</h2>
			<form method="POST" action="?/save">
				<fieldset>
					<legend>General</legend>
					{#each data.configurationFields as field (field.name)}
						<label>
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
					<button type="submit">Save configuration</button>
				</fieldset>
			</form>
		</section>
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
					<button type="submit">Add variable</button>
				</form>
			</details>
		</section>
	{/if}

	{#if related.logs !== undefined || record.logs}
		<section id="logs">
			<h2>Logs</h2>
			<LogViewer
				initial={related.logs ?? record.logs}
				url={logKind() ? `/internal/poll/${logKind()}/${encodeURIComponent(data.uuid)}` : undefined}
			/>
		</section>
	{/if}

	{#if related.storages}
		<section id="storage">
			<h2>Storage</h2>
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
		<section>
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
{/if}
