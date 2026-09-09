import { fail, type RequestEvent } from '@sveltejs/kit';

import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import { CoolifyError } from './coolify-client';

export type ScheduledTaskResourceKind = 'applications' | 'services';

export interface ScheduledTaskExecutionSummary {
	id: string;
	status: 'running' | 'success' | 'failed' | 'unknown';
	message: string;
	retryCount: number;
	duration: number | null;
	startedAt: string;
	finishedAt: string;
	createdAt: string;
}

export interface ScheduledTaskSummary {
	id: string;
	name: string;
	command: string;
	frequency: string;
	container: string;
	timeout: number;
	enabled: boolean;
	executions: ScheduledTaskExecutionSummary[];
	executionError?: string;
}

export interface ScheduledTaskBody {
	name: string;
	command: string;
	frequency: string;
	container: string | null;
	timeout: number;
	enabled: boolean;
}

interface ScheduledTaskSubmission {
	body?: ScheduledTaskBody;
	values: Record<string, string | number | boolean>;
	fieldErrors: Record<string, string>;
}

const TASK_FIELDS = new Set(['name', 'command', 'frequency', 'container', 'timeout', 'enabled']);

function booleanField(form: FormData, name: string, fallback: boolean): boolean {
	if (!form.has(name)) return fallback;
	const value = String(form.getAll(name).at(-1) ?? '').toLowerCase();
	return ['true', '1', 'on', 'yes'].includes(value);
}

export function normalizeScheduledTaskExecutions(value: unknown): ScheduledTaskExecutionSummary[] {
	return normalizeRecords(value).map((execution) => {
		const rawStatus = firstText(execution, ['status']).toLowerCase();
		const durationText = firstText(execution, ['duration']);
		const duration = durationText ? Number(durationText) : Number.NaN;
		return {
			id: firstText(execution, ['uuid', 'id']),
			status: ['running', 'success', 'failed'].includes(rawStatus)
				? (rawStatus as ScheduledTaskExecutionSummary['status'])
				: 'unknown',
			message: firstText(execution, ['message']),
			retryCount: Number(firstText(execution, ['retry_count'])) || 0,
			duration: Number.isFinite(duration) && duration >= 0 ? duration : null,
			startedAt: firstText(execution, ['started_at']),
			finishedAt: firstText(execution, ['finished_at']),
			createdAt: firstText(execution, ['created_at'])
		};
	});
}

export function normalizeScheduledTasks(value: unknown): ScheduledTaskSummary[] {
	return normalizeRecords(value)
		.map((task) => {
			const id = firstText(task, ['uuid', 'id']);
			if (!id) return undefined;
			const timeout = Number(firstText(task, ['timeout']));
			return {
				id,
				name: firstText(task, ['name']) || 'Scheduled task',
				command: firstText(task, ['command']),
				frequency: firstText(task, ['frequency']),
				container: firstText(task, ['container']),
				timeout: Number.isInteger(timeout) && timeout > 0 ? timeout : 300,
				enabled: task.enabled !== false,
				executions: normalizeScheduledTaskExecutions(task.executions)
			};
		})
		.filter((task) => task !== undefined);
}

export function scheduledTaskSubmission(form: FormData): ScheduledTaskSubmission {
	const name = String(form.get('name') ?? '').trim();
	const command = String(form.get('command') ?? '').trim();
	const frequency = String(form.get('frequency') ?? '').trim();
	const container = String(form.get('container') ?? '').trim();
	const timeoutText = String(form.get('timeout') ?? '300').trim();
	const timeout = Number(timeoutText);
	const enabled = booleanField(form, 'enabled', true);
	const values = { name, command, frequency, container, timeout: timeoutText, enabled };
	const fieldErrors: Record<string, string> = {};
	if (!name) fieldErrors.name = 'Name is required.';
	else if (name.length > 255) fieldErrors.name = 'Name must be 255 characters or fewer.';
	if (!command) fieldErrors.command = 'Command is required.';
	if (!frequency) fieldErrors.frequency = 'Schedule is required.';
	if (!Number.isInteger(timeout) || timeout < 1)
		fieldErrors.timeout = 'Timeout must be a positive whole number of seconds.';
	return {
		body:
			Object.keys(fieldErrors).length === 0
				? { name, command, frequency, container: container || null, timeout, enabled }
				: undefined,
		values,
		fieldErrors
	};
}

function firstError(value: unknown): string | undefined {
	const candidate = Array.isArray(value) ? value[0] : value;
	return candidate === undefined ? undefined : String(candidate);
}

function scheduledTaskFailure(caught: unknown) {
	const status = caught instanceof CoolifyError ? caught.status : 500;
	const details = caught instanceof CoolifyError ? asRecord(caught.details) : undefined;
	const errors = asRecord(details?.errors);
	const fieldErrors: Record<string, string> = {};
	for (const [field, rawError] of Object.entries(errors ?? {})) {
		if (TASK_FIELDS.has(field)) fieldErrors[field] = firstError(rawError) ?? 'Invalid value.';
	}
	let error = caught instanceof Error ? caught.message : 'Coolify request failed.';
	if (status === 401) error = 'Coolify rejected the configured API token.';
	if (status === 403) error = 'The Coolify token cannot manage scheduled tasks.';
	if (status === 429)
		error =
			caught instanceof CoolifyError && caught.retryAfterSeconds
				? `Coolify rate-limited this request. Retry in ${caught.retryAfterSeconds} seconds.`
				: 'Coolify rate-limited this request. Retry later.';
	return { error, fieldErrors };
}

function failureStatus(caught: unknown): number {
	return caught instanceof CoolifyError && caught.status >= 400 && caught.status <= 599
		? caught.status
		: 500;
}

function eventResourceUuid(event: RequestEvent): string {
	const uuid = event.params.uuid;
	if (!uuid) throw new CoolifyError('Resource identifier is required.', 400);
	return uuid;
}

function taskPath(
	resourceKind: ScheduledTaskResourceKind,
	resourceUuid: string,
	taskUuid?: string
): string {
	const base = `/${resourceKind}/${encodeURIComponent(resourceUuid)}/scheduled-tasks`;
	return taskUuid ? `${base}/${encodeURIComponent(taskUuid)}` : base;
}

async function currentTask(
	resourceKind: ScheduledTaskResourceKind,
	resourceUuid: string,
	taskUuid: string
): Promise<ScheduledTaskSummary | undefined> {
	const { getCoolifyClient } = await import('./runtime');
	return normalizeScheduledTasks(
		await getCoolifyClient().request('GET', taskPath(resourceKind, resourceUuid))
	).find((task) => task.id === taskUuid);
}

async function mutateTask(
	request: { method: 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown },
	operation: string,
	username?: string
) {
	const { audit, getCoolifyClient } = await import('./runtime');
	const started = Date.now();
	try {
		const data = await getCoolifyClient().request(request.method, request.path, {
			body: request.body
		});
		audit({
			user: username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { success: true as const, data };
	} catch (caught) {
		audit({
			user: username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return { success: false as const, caught };
	}
}

async function invalidateTaskViews(resourceKind: ScheduledTaskResourceKind) {
	const { invalidateCollection } = await import('./inventory-cache');
	for (const collection of [resourceKind, 'resources', 'projects'])
		invalidateCollection(collection);
}

export function createScheduledTaskActions(
	resourceKind: ScheduledTaskResourceKind = 'applications'
) {
	const resourceName = resourceKind.slice(0, -1);
	return {
		createTask: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const submission = scheduledTaskSubmission(await event.request.formData());
			if (!submission.body)
				return fail(400, {
					error: 'Correct the highlighted task fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target: 'create',
					operation: 'create'
				});
			const result = await mutateTask(
				{ method: 'POST', path: taskPath(resourceKind, resourceUuid), body: submission.body },
				`create-${resourceName}-scheduled-task`,
				event.locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), {
					...scheduledTaskFailure(result.caught),
					values: submission.values,
					target: 'create',
					operation: 'create'
				});
			await invalidateTaskViews(resourceKind);
			return { message: 'Scheduled task created', target: 'create', operation: 'create' };
		},

		updateTask: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('task_uuid') ?? '');
			const submission = scheduledTaskSubmission(form);
			if (!submission.body)
				return fail(400, {
					error: 'Correct the highlighted task fields.',
					fieldErrors: submission.fieldErrors,
					values: submission.values,
					target,
					operation: 'update'
				});
			const result = await mutateTask(
				{
					method: 'PATCH',
					path: taskPath(resourceKind, resourceUuid, target),
					body: submission.body
				},
				`update-${resourceName}-scheduled-task`,
				event.locals.user?.username
			);
			if (!result.success)
				return fail(failureStatus(result.caught), {
					...scheduledTaskFailure(result.caught),
					values: submission.values,
					target,
					operation: 'update'
				});
			await invalidateTaskViews(resourceKind);
			return { message: 'Scheduled task updated', target, operation: 'update' };
		},

		deleteTask: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('task_uuid') ?? '');
			try {
				const task = await currentTask(resourceKind, resourceUuid, target);
				if (!task)
					return fail(404, { error: 'Scheduled task not found.', target, operation: 'delete' });
				if (String(form.get('confirmation') ?? '') !== task.name)
					return fail(400, {
						error: `Type ${task.name} exactly to delete this task and its executions.`,
						target,
						operation: 'delete'
					});
				const result = await mutateTask(
					{ method: 'DELETE', path: taskPath(resourceKind, resourceUuid, target) },
					`delete-${resourceName}-scheduled-task`,
					event.locals.user?.username
				);
				if (!result.success)
					return fail(failureStatus(result.caught), {
						...scheduledTaskFailure(result.caught),
						target,
						operation: 'delete'
					});
				await invalidateTaskViews(resourceKind);
				return { message: 'Scheduled task deleted', target, operation: 'delete' };
			} catch (caught) {
				return fail(failureStatus(caught), {
					...scheduledTaskFailure(caught),
					target,
					operation: 'delete'
				});
			}
		},

		executeTask: async (event: RequestEvent) => {
			const resourceUuid = eventResourceUuid(event);
			const form = await event.request.formData();
			const target = String(form.get('task_uuid') ?? '');
			try {
				const task = await currentTask(resourceKind, resourceUuid, target);
				if (!task)
					return fail(404, { error: 'Scheduled task not found.', target, operation: 'execute' });
				const expected = `run ${task.name}`;
				if (String(form.get('confirmation') ?? '') !== expected)
					return fail(400, {
						error: `Type ${expected} exactly to queue this task now.`,
						target,
						operation: 'execute'
					});
				const result = await mutateTask(
					{
						method: 'POST',
						path: `${taskPath(resourceKind, resourceUuid, target)}/execute`
					},
					`execute-${resourceName}-scheduled-task`,
					event.locals.user?.username
				);
				if (!result.success)
					return fail(failureStatus(result.caught), {
						...scheduledTaskFailure(result.caught),
						target,
						operation: 'execute'
					});
				return { message: 'Scheduled task execution queued', target, operation: 'execute' };
			} catch (caught) {
				return fail(failureStatus(caught), {
					...scheduledTaskFailure(caught),
					target,
					operation: 'execute'
				});
			}
		}
	};
}
