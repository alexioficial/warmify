import { asRecord } from '$lib/resource-presenter';

export const NOTIFICATION_EVENT_KEYS = [
	'deployment_success',
	'deployment_failure',
	'status_change',
	'backup_success',
	'backup_failure',
	'scheduled_task_success',
	'scheduled_task_failure',
	'docker_cleanup_success',
	'docker_cleanup_failure',
	'server_disk_usage',
	'server_reachable',
	'server_unreachable',
	'server_patch',
	'traefik_outdated'
] as const;

export const NOTIFICATION_EVENTS = [
	{ id: 'deployment_success', label: 'Deployment succeeded' },
	{ id: 'deployment_failure', label: 'Deployment failed' },
	{ id: 'status_change', label: 'Resource status changed' },
	{ id: 'backup_success', label: 'Backup succeeded' },
	{ id: 'backup_failure', label: 'Backup failed' },
	{ id: 'scheduled_task_success', label: 'Scheduled task succeeded' },
	{ id: 'scheduled_task_failure', label: 'Scheduled task failed' },
	{ id: 'docker_cleanup_success', label: 'Docker cleanup succeeded' },
	{ id: 'docker_cleanup_failure', label: 'Docker cleanup failed' },
	{ id: 'server_disk_usage', label: 'Server disk usage warning' },
	{ id: 'server_reachable', label: 'Server became reachable' },
	{ id: 'server_unreachable', label: 'Server became unreachable' },
	{ id: 'server_patch', label: 'Server patch available' },
	{ id: 'traefik_outdated', label: 'Traefik is outdated' }
] as const;

export type NotificationChannel =
	'email' | 'discord' | 'slack' | 'telegram' | 'pushover' | 'webhook';

export interface NotificationToggleDefinition {
	name: string;
	label: string;
	section: 'delivery' | 'events';
}

export interface NotificationFieldDefinition {
	name: string;
	label: string;
	type: 'text' | 'email' | 'url' | 'number' | 'select' | 'password';
	section: 'delivery' | 'threads';
	sensitive: boolean;
	nullable: boolean;
	max?: number;
	min?: number;
	options?: ReadonlyArray<{ value: string; label: string }>;
}

export interface NotificationChannelDefinition {
	id: NotificationChannel;
	label: string;
	description: string;
	toggles: ReadonlyArray<NotificationToggleDefinition>;
	fields: ReadonlyArray<NotificationFieldDefinition>;
}

const eventToggles = (channel: NotificationChannel): NotificationToggleDefinition[] =>
	NOTIFICATION_EVENTS.map((event) => ({
		name: `${event.id}_${channel}_notifications`,
		label: event.label,
		section: 'events'
	}));

const field = (
	name: string,
	label: string,
	type: NotificationFieldDefinition['type'],
	sensitive: boolean,
	options: Partial<NotificationFieldDefinition> = {}
): NotificationFieldDefinition => ({
	name,
	label,
	type,
	section: 'delivery',
	sensitive,
	nullable: true,
	...options
});

const channelDefinitions: Record<NotificationChannel, NotificationChannelDefinition> = {
	email: {
		id: 'email',
		label: 'Email',
		description: 'Deliver team notifications through SMTP, Resend, or the instance email settings.',
		toggles: [
			{ name: 'smtp_enabled', label: 'Enable SMTP', section: 'delivery' },
			{ name: 'resend_enabled', label: 'Enable Resend', section: 'delivery' },
			{
				name: 'use_instance_email_settings',
				label: 'Use instance email settings',
				section: 'delivery'
			},
			...eventToggles('email')
		],
		fields: [
			field('smtp_from_address', 'From address', 'email', true, { max: 255 }),
			field('smtp_from_name', 'From name', 'text', true, { max: 255 }),
			field('smtp_recipients', 'Recipients', 'text', true, { max: 1000 }),
			field('smtp_host', 'SMTP host', 'text', true, { max: 255 }),
			field('smtp_port', 'SMTP port', 'number', false, { min: 1, max: 65535 }),
			field('smtp_encryption', 'SMTP encryption', 'select', false, {
				options: [
					{ value: 'starttls', label: 'STARTTLS' },
					{ value: 'tls', label: 'TLS' },
					{ value: 'none', label: 'None' }
				]
			}),
			field('smtp_username', 'SMTP username', 'text', true, { max: 255 }),
			field('smtp_password', 'SMTP password', 'password', true, { max: 255 }),
			field('smtp_timeout', 'SMTP timeout (seconds)', 'number', false, { min: 0 }),
			field('smtp_ehlo_domain', 'SMTP EHLO domain', 'text', false, { max: 255 }),
			field('resend_api_key', 'Resend API key', 'password', true, { max: 255 })
		]
	},
	discord: {
		id: 'discord',
		label: 'Discord',
		description: 'Send notifications to a Discord webhook.',
		toggles: [
			{ name: 'discord_enabled', label: 'Enable Discord', section: 'delivery' },
			{ name: 'discord_ping_enabled', label: 'Ping on notifications', section: 'delivery' },
			...eventToggles('discord')
		],
		fields: [field('discord_webhook_url', 'Discord webhook URL', 'url', true, { max: 2048 })]
	},
	slack: {
		id: 'slack',
		label: 'Slack',
		description: 'Send notifications to a Slack webhook.',
		toggles: [
			{ name: 'slack_enabled', label: 'Enable Slack', section: 'delivery' },
			...eventToggles('slack')
		],
		fields: [field('slack_webhook_url', 'Slack webhook URL', 'url', true, { max: 2048 })]
	},
	telegram: {
		id: 'telegram',
		label: 'Telegram',
		description: 'Send notifications through a Telegram bot and optional event threads.',
		toggles: [
			{ name: 'telegram_enabled', label: 'Enable Telegram', section: 'delivery' },
			...eventToggles('telegram')
		],
		fields: [
			field('telegram_token', 'Bot token', 'password', true, { max: 255 }),
			field('telegram_chat_id', 'Chat ID', 'text', true, { max: 255 }),
			...NOTIFICATION_EVENTS.map((event) =>
				field(
					`telegram_notifications_${event.id}_thread_id`,
					`${event.label} thread ID`,
					'text',
					true,
					{ max: 255, section: 'threads' }
				)
			)
		]
	},
	pushover: {
		id: 'pushover',
		label: 'Pushover',
		description: 'Send notifications through a Pushover application.',
		toggles: [
			{ name: 'pushover_enabled', label: 'Enable Pushover', section: 'delivery' },
			...eventToggles('pushover')
		],
		fields: [
			field('pushover_user_key', 'User key', 'password', true, { max: 255 }),
			field('pushover_api_token', 'API token', 'password', true, { max: 255 })
		]
	},
	webhook: {
		id: 'webhook',
		label: 'Webhook',
		description: 'Send JSON notifications to a custom webhook endpoint.',
		toggles: [
			{ name: 'webhook_enabled', label: 'Enable webhook', section: 'delivery' },
			...eventToggles('webhook')
		],
		fields: [field('webhook_url', 'Webhook URL', 'url', true, { max: 2048 })]
	}
};

export const NOTIFICATION_CHANNELS = Object.values(channelDefinitions);

export function notificationChannel(value: unknown): NotificationChannel | undefined {
	const channel = String(value ?? '').toLowerCase();
	return channel in channelDefinitions ? (channel as NotificationChannel) : undefined;
}

export function notificationDefinition(channel: NotificationChannel) {
	return channelDefinitions[channel];
}

export interface NotificationSettingsView {
	channel: NotificationChannel;
	toggles: Record<string, boolean>;
	fields: Record<string, string>;
	configuredSecrets: Record<string, boolean>;
}

const enabled = (value: unknown) =>
	value === true || value === 1 || value === '1' || value === 'true';

export function notificationSettingsView(
	channel: NotificationChannel,
	value: unknown
): NotificationSettingsView {
	const record = asRecord(value) ?? {};
	const definition = notificationDefinition(channel);
	return {
		channel,
		toggles: Object.fromEntries(
			definition.toggles.map((toggle) => [toggle.name, enabled(record[toggle.name])])
		),
		fields: Object.fromEntries(
			definition.fields
				.filter((entry) => !entry.sensitive)
				.map((entry) => [entry.name, record[entry.name] == null ? '' : String(record[entry.name])])
		),
		configuredSecrets: Object.fromEntries(
			definition.fields
				.filter((entry) => entry.sensitive)
				.map((entry) => [
					entry.name,
					typeof record[entry.name] === 'string' && String(record[entry.name]).length > 0
				])
		)
	};
}

export interface NotificationSubmissionValues {
	toggles: Record<string, boolean>;
	fields: Record<string, string>;
	modes: Record<string, 'keep' | 'replace' | 'clear'>;
}

function validUrl(value: string) {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

function validEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validHostname(value: string) {
	return (
		value.length <= 255 &&
		/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(
			value
		)
	);
}

function validateText(field: NotificationFieldDefinition, value: string) {
	if (field.max !== undefined && value.length > field.max)
		return `Use at most ${field.max} characters.`;
	if (field.type === 'email' && value && !validEmail(value)) return 'Enter a valid email address.';
	if (field.type === 'url' && value && !validUrl(value)) return 'Enter a valid HTTP or HTTPS URL.';
	if (field.name === 'smtp_ehlo_domain' && value && !validHostname(value))
		return 'Enter a valid hostname without a scheme or path.';
	return '';
}

export function notificationSubmission(channel: NotificationChannel, form: FormData) {
	const definition = notificationDefinition(channel);
	const fieldErrors: Record<string, string> = {};
	const body: Record<string, unknown> = {};
	const values: NotificationSubmissionValues = { toggles: {}, fields: {}, modes: {} };
	const sensitiveValues: string[] = [];

	for (const toggle of definition.toggles) {
		const value = enabled(form.getAll(toggle.name).at(-1));
		values.toggles[toggle.name] = value;
		body[toggle.name] = value;
	}

	for (const current of definition.fields) {
		const raw = String(form.get(current.name) ?? '').trim();
		if (current.sensitive) {
			const modeValue = String(form.get(`${current.name}_mode`) ?? 'keep');
			const mode = ['keep', 'replace', 'clear'].includes(modeValue)
				? (modeValue as 'keep' | 'replace' | 'clear')
				: 'keep';
			values.modes[current.name] = mode;
			if (modeValue !== mode)
				fieldErrors[`${current.name}_mode`] = 'Select keep, replace or clear.';
			if (mode === 'clear') body[current.name] = null;
			if (mode === 'replace') {
				if (!raw) fieldErrors[current.name] = 'Enter a replacement value.';
				else {
					const problem = validateText(current, raw);
					if (problem) fieldErrors[current.name] = problem;
					else {
						body[current.name] = raw;
						sensitiveValues.push(raw);
					}
				}
			}
			continue;
		}

		values.fields[current.name] = raw;
		if (!raw) {
			body[current.name] = null;
			continue;
		}
		if (current.type === 'number') {
			const numeric = Number(raw);
			if (
				!Number.isInteger(numeric) ||
				(current.min !== undefined && numeric < current.min) ||
				(current.max !== undefined && numeric > current.max)
			) {
				fieldErrors[current.name] =
					`Enter a whole number${current.min !== undefined ? ` from ${current.min}` : ''}${current.max !== undefined ? ` to ${current.max}` : ' or greater'}.`;
			} else body[current.name] = numeric;
			continue;
		}
		if (current.type === 'select') {
			if (!current.options?.some((option) => option.value === raw))
				fieldErrors[current.name] = 'Select a supported value.';
			else body[current.name] = raw;
			continue;
		}
		const problem = validateText(current, raw);
		if (problem) fieldErrors[current.name] = problem;
		else body[current.name] = raw;
	}

	return {
		body: Object.keys(fieldErrors).length ? undefined : body,
		fieldErrors,
		values,
		sensitiveValues
	};
}
