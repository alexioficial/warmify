import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';

import {
	notificationChannel,
	notificationDefinition,
	notificationSettingsView,
	notificationSubmission
} from '$lib/notification-settings';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';

function channelFromEvent(event: RequestEvent) {
	const channel = notificationChannel(event.params.channel);
	if (!channel) error(404, 'Notification channel not found.');
	return channel;
}

function status(caught: unknown) {
	const value = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return value >= 400 && value <= 599 ? value : 500;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

export async function loadNotificationChannel(event: RequestEvent) {
	event.setHeaders({ 'cache-control': 'no-store' });
	const channel = channelFromEvent(event);
	const definition = notificationDefinition(channel);
	try {
		const settings = notificationSettingsView(
			channel,
			await getCoolifyClient().request('GET', `/notifications/${channel}`)
		);
		return {
			definition,
			settings,
			requestError: '',
			breadcrumbs: [
				{ label: 'Notifications', href: '/notifications' },
				{ label: definition.label, href: `/notifications/${channel}` }
			]
		};
	} catch {
		return {
			definition,
			settings: notificationSettingsView(channel, {}),
			requestError: `${definition.label} notification settings could not be loaded.`,
			breadcrumbs: [
				{ label: 'Notifications', href: '/notifications' },
				{ label: definition.label, href: `/notifications/${channel}` }
			]
		};
	}
}

export async function updateNotificationChannel(event: RequestEvent) {
	const started = Date.now();
	let definition;
	try {
		assertMutation(event);
		const channel = channelFromEvent(event);
		definition = notificationDefinition(channel);
		const submission = notificationSubmission(channel, await event.request.formData());
		if (!submission.body)
			return fail(400, {
				error: 'Correct the highlighted fields.',
				values: submission.values,
				fieldErrors: submission.fieldErrors
			});
		await getCoolifyClient().request('PATCH', `/notifications/${channel}`, {
			body: submission.body
		});
		audit({
			user: event.locals.user?.username,
			operation: `update-${channel}-notifications`,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return {
			message: `${definition.label} notification settings saved.`,
			values: submission.values
		};
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation: `update-${event.params.channel ?? 'unknown'}-notifications`,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			error: isHttpError(caught)
				? caught.body.message
				: `${definition?.label ?? 'Notification'} settings could not be saved. No automatic retry was attempted.`
		});
	}
}
