import { describe, expect, test } from 'vitest';

import {
	NOTIFICATION_CHANNELS,
	notificationSettingsView,
	notificationSubmission
} from './notification-settings';

describe('notification settings contract', () => {
	test('freezes every public notification channel', () => {
		expect(NOTIFICATION_CHANNELS.map((channel) => channel.id)).toEqual([
			'email',
			'discord',
			'slack',
			'telegram',
			'pushover',
			'webhook'
		]);
	});

	test('projects only safe values and secret-presence markers', () => {
		const view = notificationSettingsView('email', {
			smtp_enabled: true,
			smtp_host: 'smtp-secret.example.com',
			smtp_password: 'smtp-password-secret',
			resend_api_key: 'resend-secret',
			smtp_port: 587,
			smtp_encryption: 'starttls',
			deployment_failure_email_notifications: true,
			forged: 'unexpected-secret'
		});
		expect(view.toggles.smtp_enabled).toBe(true);
		expect(view.toggles.deployment_failure_email_notifications).toBe(true);
		expect(view.fields).toMatchObject({ smtp_port: '587', smtp_encryption: 'starttls' });
		expect(view.configuredSecrets).toMatchObject({
			smtp_host: true,
			smtp_password: true,
			resend_api_key: true
		});
		expect(JSON.stringify(view)).not.toMatch(
			/smtp-secret\.example\.com|smtp-password-secret|resend-secret|unexpected-secret/
		);
	});

	test('builds an exact email PATCH and omits secrets in keep mode', () => {
		const form = new FormData();
		form.set('smtp_enabled', 'true');
		form.set('smtp_port', '587');
		form.set('smtp_timeout', '30');
		form.set('smtp_encryption', 'starttls');
		form.set('smtp_ehlo_domain', 'mail.example.com');
		form.set('smtp_password_mode', 'keep');
		form.set('smtp_password', 'ignored-secret');
		form.set('smtp_host_mode', 'replace');
		form.set('smtp_host', 'smtp.example.com');
		form.set('deployment_failure_email_notifications', 'true');
		form.set('forged', 'ignored');
		const result = notificationSubmission('email', form);
		expect(result.fieldErrors).toEqual({});
		expect(result.body).toMatchObject({
			smtp_enabled: true,
			resend_enabled: false,
			use_instance_email_settings: false,
			smtp_port: 587,
			smtp_timeout: 30,
			smtp_encryption: 'starttls',
			smtp_ehlo_domain: 'mail.example.com',
			smtp_host: 'smtp.example.com',
			deployment_failure_email_notifications: true,
			deployment_success_email_notifications: false
		});
		expect(result.body).not.toHaveProperty('smtp_password');
		expect(result.body).not.toHaveProperty('forged');
		expect(JSON.stringify(result.values)).not.toMatch(/ignored-secret|smtp\.example\.com/);
		expect(result.sensitiveValues).toEqual(['smtp.example.com']);
	});

	test('supports explicit clear and replacement for channel credentials', () => {
		const form = new FormData();
		form.set('webhook_enabled', 'true');
		form.set('webhook_url_mode', 'clear');
		const webhook = notificationSubmission('webhook', form);
		expect(webhook.body).toMatchObject({ webhook_enabled: true, webhook_url: null });

		const telegramForm = new FormData();
		telegramForm.set('telegram_token_mode', 'replace');
		telegramForm.set('telegram_token', 'telegram-browser-secret');
		telegramForm.set('telegram_chat_id_mode', 'keep');
		telegramForm.set('telegram_notifications_deployment_failure_thread_id_mode', 'replace');
		telegramForm.set('telegram_notifications_deployment_failure_thread_id', 'thread-42');
		const telegram = notificationSubmission('telegram', telegramForm);
		expect(telegram.body).toMatchObject({
			telegram_token: 'telegram-browser-secret',
			telegram_notifications_deployment_failure_thread_id: 'thread-42'
		});
		expect(telegram.body).not.toHaveProperty('telegram_chat_id');
		expect(JSON.stringify(telegram.values)).not.toMatch(/telegram-browser-secret|thread-42/);
	});

	test('rejects invalid safe values and empty replacements without retaining secrets', () => {
		const form = new FormData();
		form.set('smtp_port', '70000');
		form.set('smtp_timeout', '-1');
		form.set('smtp_encryption', 'ssl');
		form.set('smtp_ehlo_domain', 'https://not-a-host.example');
		form.set('smtp_password_mode', 'replace');
		form.set('smtp_password', '');
		form.set('resend_api_key_mode', 'replace');
		form.set('resend_api_key', 'submitted-password-secret');
		const result = notificationSubmission('email', form);
		expect(result.body).toBeUndefined();
		expect(result.fieldErrors).toMatchObject({
			smtp_port: expect.any(String),
			smtp_timeout: expect.any(String),
			smtp_encryption: expect.any(String),
			smtp_ehlo_domain: expect.any(String),
			smtp_password: expect.any(String)
		});
		expect(JSON.stringify(result.values)).not.toContain('submitted-password-secret');
	});
});
