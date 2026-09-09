import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('loads every public channel and updates notification credentials without leaking them', async ({
	page
}) => {
	await login(page);
	await page.goto('/notifications');
	for (const channel of ['Email', 'Discord', 'Slack', 'Telegram', 'Pushover', 'Webhook']) {
		await expect(page.getByRole('link', { name: new RegExp(`^${channel}`) })).toBeVisible();
	}

	for (const channel of ['email', 'discord', 'slack', 'telegram', 'pushover', 'webhook']) {
		await page.goto(`/notifications/${channel}`);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		expect(await page.content()).not.toContain('notification-fixture-secret');
	}

	await page.goto('/notifications/discord');
	await page.getByLabel('Enable Discord').check();
	await page.getByLabel('Discord webhook URL stored value').selectOption('replace');
	await page
		.getByLabel('Discord webhook URL replacement')
		.fill('https://discord.com/api/webhooks/browser-notification-secret');
	await page.getByLabel('Deployment failed').check();
	await page.getByRole('button', { name: 'Save notification settings' }).click();
	await expect(page.getByRole('status')).toHaveText('Discord notification settings saved.');
	expect(await page.content()).not.toContain('browser-notification-secret');
	await expect(page.getByLabel('Discord webhook URL replacement')).toBeEmpty();

	await page.goto('/notifications/email');
	await page.getByLabel('SMTP port').fill('2525');
	await page.getByLabel('SMTP encryption').selectOption('tls');
	await page.getByLabel('SMTP password stored value').selectOption('replace');
	await page.getByLabel('SMTP password replacement').fill('browser-smtp-secret');
	await page.getByRole('button', { name: 'Save notification settings' }).click();
	await expect(page.getByRole('status')).toHaveText('Email notification settings saved.');
	expect(await page.content()).not.toContain('browser-smtp-secret');
	await expect(page.getByLabel('SMTP port')).toHaveValue('2525');
});
