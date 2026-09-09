import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { asRecord, firstText, normalizeRecords } from '../resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';
import { loadServer } from './server-pages';

const validId = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const flag = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const formFlag = (form: FormData, name: string) => flag(form.getAll(name).at(-1));

export function dockerCleanupSettings(value: unknown) {
	const row = asRecord(value) ?? {};
	const threshold = Number(row.docker_cleanup_threshold);
	return {
		frequency: firstText(row, ['docker_cleanup_frequency']) || '0 23 * * *',
		threshold: Number.isSafeInteger(threshold) ? threshold : 80,
		force: flag(row.force_docker_cleanup),
		deleteUnusedVolumes: flag(row.delete_unused_volumes),
		deleteUnusedNetworks: flag(row.delete_unused_networks),
		disableImageRetention: flag(row.disable_application_image_retention)
	};
}

function safeMessage(value: unknown) {
	if (typeof value !== 'string') return '';
	return value
		.replace(
			/(\b(?:password|passwd|secret|token|api_key|private_key)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
			'$1[REDACTED]'
		)
		.replace(/(\bAuthorization\s*:\s*Bearer\s+)\S+/gi, '$1[REDACTED]')
		.slice(0, 2_000);
}

export function dockerCleanupExecutions(value: unknown) {
	return normalizeRecords(value)
		.slice(0, 20)
		.map((row) => ({
			uuid: firstText(row, ['uuid']),
			status: firstText(row, ['status']) || 'unknown',
			message: safeMessage(row.message),
			createdAt: firstText(row, ['created_at']),
			finishedAt: firstText(row, ['finished_at'])
		}))
		.filter((row) => validId(row.uuid));
}

function path(uuid: string, suffix = '') {
	if (!validId(uuid)) error(404, 'Server not found.');
	return `/servers/${encodeURIComponent(uuid)}/docker-cleanup${suffix}`;
}

export async function loadDockerCleanup(event: RequestEvent) {
	const uuid = event.params.uuid ?? '';
	await loadServer(uuid);
	try {
		const [settings, executions] = await Promise.all([
			getCoolifyClient().request('GET', path(uuid)),
			getCoolifyClient().request('GET', path(uuid, '/executions'))
		]);
		return {
			settings: dockerCleanupSettings(settings),
			executions: dockerCleanupExecutions(executions),
			requestError: ''
		};
	} catch {
		return {
			settings: dockerCleanupSettings({}),
			executions: [],
			requestError: 'Docker cleanup settings and history could not be loaded.'
		};
	}
}

function status(caught: unknown) {
	const candidate = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

async function mutate(
	event: RequestEvent,
	operation: string,
	callback: (uuid: string, form: FormData) => Promise<{ message: string }>
) {
	const started = Date.now();
	try {
		assertMutation(event);
		const uuid = event.params.uuid ?? '';
		if (!validId(uuid)) error(404, 'Server not found.');
		const form = await event.request.formData();
		const result = await callback(uuid, form);
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return result;
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			error:
				'The Docker cleanup operation could not be completed. Check the settings and try again.'
		});
	}
}

export const dockerCleanupActions = {
	update: (event: RequestEvent) =>
		mutate(event, 'update-server-docker-cleanup', async (uuid, form) => {
			const frequency = String(form.get('docker_cleanup_frequency') ?? '').trim();
			const threshold = Number(form.get('docker_cleanup_threshold'));
			if (!frequency || frequency.length > 255) error(400, 'Enter a valid cleanup frequency.');
			if (!Number.isSafeInteger(threshold) || threshold < 1 || threshold > 99)
				error(400, 'Enter a cleanup threshold from 1 to 99.');
			const body = {
				docker_cleanup_frequency: frequency,
				docker_cleanup_threshold: threshold,
				force_docker_cleanup: formFlag(form, 'force_docker_cleanup'),
				delete_unused_volumes: formFlag(form, 'delete_unused_volumes'),
				delete_unused_networks: formFlag(form, 'delete_unused_networks'),
				disable_application_image_retention: formFlag(form, 'disable_application_image_retention')
			};
			await loadServer(uuid);
			await getCoolifyClient().request('PATCH', path(uuid), { body });
			return { message: 'Docker cleanup settings saved.' };
		}),
	run: (event: RequestEvent) =>
		mutate(event, 'run-server-docker-cleanup', async (uuid, form) => {
			if (String(form.get('confirmation') ?? '') !== 'RUN CLEANUP')
				error(400, 'Type RUN CLEANUP exactly to start cleanup.');
			const body = {
				delete_unused_volumes: formFlag(form, 'delete_unused_volumes'),
				delete_unused_networks: formFlag(form, 'delete_unused_networks')
			};
			await loadServer(uuid);
			await getCoolifyClient().request('POST', path(uuid, '/run'), { body });
			return { message: 'Docker cleanup started.' };
		})
};
