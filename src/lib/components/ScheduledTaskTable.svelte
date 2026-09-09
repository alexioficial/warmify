<script lang="ts">
	import { formatRelativeTime, formatTimestamp } from '$lib/resource-presenter';
	import type { ScheduledTaskSummary } from '$lib/server/scheduled-task-actions';

	interface TaskActionResult {
		error?: string;
		message?: string;
		target?: string;
		operation?: string;
		fieldErrors?: Record<string, string>;
		values?: Record<string, string | boolean | number>;
	}

	let {
		tasks,
		form,
		ready
	}: { tasks: ScheduledTaskSummary[]; form: TaskActionResult | null; ready: boolean } = $props();

	function fieldValue(task: ScheduledTaskSummary, name: keyof ScheduledTaskSummary) {
		if (
			form?.target === task.id &&
			form.operation === 'update' &&
			form.values?.[name] !== undefined
		)
			return form.values[name];
		return task[name];
	}

	function executionStatusClass(status: string) {
		return `status status-${status}`;
	}

	function executionDuration(task: ScheduledTaskSummary) {
		const execution = task.executions[0];
		if (!execution) return 'Not run yet';
		if (execution.status === 'running') return 'Running now';
		return execution.duration === null ? execution.status : `${execution.duration.toFixed(2)}s`;
	}
</script>

{#if tasks.length}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Task</th><th>Schedule</th><th>Container</th><th>Timeout</th><th>Latest run</th><th
						>Actions</th
					>
				</tr>
			</thead>
			<tbody>
				{#each tasks as task (task.id)}
					<tr>
						<td>
							<strong>{task.name}</strong><br />
							<code>{task.command}</code><br />
							<small>{task.enabled ? 'Enabled' : 'Disabled'}</small>
						</td>
						<td><code>{task.frequency}</code></td>
						<td>{task.container || 'Default container'}</td>
						<td>{task.timeout}s</td>
						<td>
							{#if task.executions[0]}
								<span class={executionStatusClass(task.executions[0].status)}>
									{task.executions[0].status}
								</span><br />
								<small
									>{executionDuration(task)} · {formatRelativeTime(
										task.executions[0].finishedAt || task.executions[0].createdAt
									)}</small
								>
							{:else}
								<span class="muted">Not run yet</span>
							{/if}
						</td>
						<td>
							<div class="actions task-actions">
								<details>
									<summary>Edit</summary>
									<form method="POST" action="?/updateTask">
										<input type="hidden" name="task_uuid" value={task.id} />
										<label>
											Name
											<input
												name="name"
												value={String(fieldValue(task, 'name'))}
												disabled={!ready}
												required
											/>
										</label>
										<label>
											Schedule
											<input
												name="frequency"
												value={String(fieldValue(task, 'frequency'))}
												disabled={!ready}
												required
											/>
										</label>
										<label>
											Container
											<input
												name="container"
												value={String(fieldValue(task, 'container'))}
												disabled={!ready}
											/>
										</label>
										<label>
											Timeout (seconds)
											<input
												type="number"
												name="timeout"
												min="1"
												value={String(fieldValue(task, 'timeout'))}
												disabled={!ready}
												required
											/>
										</label>
										<label>
											Command
											<textarea name="command" disabled={!ready} required
												>{String(fieldValue(task, 'command'))}</textarea
											>
										</label>
										<label class="checkbox-field">
											<input type="hidden" name="enabled" value="false" />
											<input
												type="checkbox"
												name="enabled"
												value="true"
												checked={Boolean(fieldValue(task, 'enabled'))}
												disabled={!ready}
											/>
											Enabled
										</label>
										{#if form?.target === task.id && form.operation === 'update'}
											{#each Object.entries(form.fieldErrors ?? {}) as [field, error] (field)}
												<p class="error">{error}</p>
											{/each}
										{/if}
										<button class="primary" type="submit" disabled={!ready}>Save task</button>
									</form>
								</details>

								<details>
									<summary>Run now</summary>
									<form method="POST" action="?/executeTask">
										<input type="hidden" name="task_uuid" value={task.id} />
										<label>
											Type run {task.name} to confirm
											<input name="confirmation" autocomplete="off" disabled={!ready} required />
										</label>
										<button type="submit" disabled={!ready}>Queue execution</button>
									</form>
								</details>

								<details>
									<summary>History</summary>
									{#if task.executionError}<p class="error">{task.executionError}</p>{/if}
									{#if task.executions.length}
										<div class="execution-list">
											{#each task.executions as execution (execution.id)}
												<article>
													<div class="section-heading">
														<span class={executionStatusClass(execution.status)}
															>{execution.status}</span
														>
														<small
															>{formatTimestamp(execution.startedAt || execution.createdAt)}</small
														>
													</div>
													{#if execution.message}<pre>{execution.message}</pre>{/if}
													<small>
														{execution.duration === null
															? 'Duration unavailable'
															: `${execution.duration.toFixed(2)}s`}
														· retries {execution.retryCount}
													</small>
												</article>
											{/each}
										</div>
									{:else if !task.executionError}
										<p class="muted">No executions yet.</p>
									{/if}
								</details>

								<details>
									<summary>Delete</summary>
									<form method="POST" action="?/deleteTask">
										<input type="hidden" name="task_uuid" value={task.id} />
										<label>
											Type {task.name} to confirm deletion
											<input name="confirmation" autocomplete="off" disabled={!ready} required />
										</label>
										<button class="danger" type="submit" disabled={!ready}>Delete task</button>
									</form>
								</details>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">No scheduled tasks.</p>
{/if}
