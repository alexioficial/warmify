import { beforeEach, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const request = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit }));

import { loadNotificationChannel, updateNotificationChannel } from './notification-pages';

function event(channel: string, values: Record<string, string>) {
	const form = new FormData();
	for (const [name, value] of Object.entries(values)) form.append(name, value);
	return {
		params: { channel },
		locals: { user: { username: 'admin' } },
		setHeaders: vi.fn(),
		url: new URL(`http://localhost/notifications/${channel}`),
		request: new Request(`http://localhost/notifications/${channel}`, {
			method: 'POST',
			headers: { origin: 'http://localhost' },
			body: form
		})
	} as unknown as RequestEvent;
}

beforeEach(() => {
	request.mockReset();
	audit.mockReset();
});

test('loads one channel without serializing encrypted settings', async () => {
	request.mockResolvedValue({
		discord_enabled: true,
		discord_webhook_url: 'https://discord.example/fixture-secret',
		deployment_failure_discord_notifications: true,
		unexpected_secret: 'discard-me'
	});
	const current = event('discord', {});
	const result = await loadNotificationChannel(current);
	expect(current.setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store' });
	expect(request).toHaveBeenCalledWith('GET', '/notifications/discord');
	expect(result.settings.configuredSecrets.discord_webhook_url).toBe(true);
	expect(JSON.stringify(result)).not.toMatch(/fixture-secret|discard-me/);
});

test('updates a channel through an exact allowlist and discards the upstream response', async () => {
	request.mockResolvedValue({ token: 'notification-response-secret' });
	const result = await updateNotificationChannel(
		event('discord', {
			discord_enabled: 'true',
			discord_webhook_url_mode: 'replace',
			discord_webhook_url: 'https://discord.com/api/webhooks/browser-secret',
			deployment_failure_discord_notifications: 'true',
			forged: 'ignored'
		})
	);
	expect(request).toHaveBeenCalledWith('PATCH', '/notifications/discord', {
		body: expect.objectContaining({
			discord_enabled: true,
			discord_webhook_url: 'https://discord.com/api/webhooks/browser-secret',
			deployment_failure_discord_notifications: true
		})
	});
	expect(request.mock.calls[0][2].body).not.toHaveProperty('forged');
	expect(result).toMatchObject({ message: 'Discord notification settings saved.' });
	expect(JSON.stringify(result)).not.toMatch(/browser-secret|notification-response-secret/);
});

test('rejects cross-origin updates before calling Coolify', async () => {
	const current = event('slack', { slack_enabled: 'true' });
	current.request = new Request('http://localhost/notifications/slack', {
		method: 'POST',
		headers: { origin: 'https://other.test' },
		body: new FormData()
	});
	const result = await updateNotificationChannel(current);
	expect(result).toMatchObject({ status: 403 });
	expect(request).not.toHaveBeenCalled();
});

test('returns field errors without retaining submitted secrets', async () => {
	const result = await updateNotificationChannel(
		event('pushover', {
			pushover_api_token_mode: 'replace',
			pushover_api_token: 'submitted-pushover-secret',
			pushover_user_key_mode: 'replace',
			pushover_user_key: ''
		})
	);
	expect(result).toMatchObject({ status: 400 });
	expect(JSON.stringify(result)).not.toContain('submitted-pushover-secret');
	expect(request).not.toHaveBeenCalled();
});
