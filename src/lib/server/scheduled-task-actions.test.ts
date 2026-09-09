import { describe, expect, test } from 'vitest';

import {
	normalizeScheduledTaskExecutions,
	normalizeScheduledTasks,
	scheduledTaskSubmission
} from './scheduled-task-actions';

describe('scheduled task actions', () => {
	test('normalizes task and execution metadata while dropping unknown fields', () => {
		const tasks = normalizeScheduledTasks([
			{
				uuid: 'task-1',
				name: 'Cleanup',
				command: 'php artisan cache:clear',
				frequency: 'daily',
				container: null,
				timeout: 120,
				enabled: false,
				secret: 'do-not-leak'
			}
		]);
		expect(tasks).toEqual([
			{
				id: 'task-1',
				name: 'Cleanup',
				command: 'php artisan cache:clear',
				frequency: 'daily',
				container: '',
				timeout: 120,
				enabled: false,
				executions: []
			}
		]);
		expect(JSON.stringify(tasks)).not.toContain('do-not-leak');

		expect(
			normalizeScheduledTaskExecutions([
				{ uuid: 'run-1', status: 'success', duration: 1.25, retry_count: 2 },
				{ uuid: 'run-2', status: 'unexpected' }
			])
		).toMatchObject([
			{ id: 'run-1', status: 'success', duration: 1.25, retryCount: 2 },
			{ id: 'run-2', status: 'unknown', duration: null, retryCount: 0 }
		]);
	});

	test('builds the exact create and update body with documented defaults', () => {
		const form = new FormData();
		form.set('name', 'Cleanup');
		form.set('command', 'php artisan cache:clear');
		form.set('frequency', '0 2 * * *');
		form.set('container', 'web');
		form.set('timeout', '600');
		form.set('enabled', 'false');

		const submission = scheduledTaskSubmission(form);
		expect(submission.fieldErrors).toEqual({});
		expect(submission.body).toEqual({
			name: 'Cleanup',
			command: 'php artisan cache:clear',
			frequency: '0 2 * * *',
			container: 'web',
			timeout: 600,
			enabled: false
		});
	});

	test('rejects missing required fields and non-positive or fractional timeouts', () => {
		const form = new FormData();
		form.set('timeout', '0.5');
		const submission = scheduledTaskSubmission(form);
		expect(submission.body).toBeUndefined();
		expect(submission.fieldErrors).toEqual({
			name: 'Name is required.',
			command: 'Command is required.',
			frequency: 'Schedule is required.',
			timeout: 'Timeout must be a positive whole number of seconds.'
		});
	});
});
