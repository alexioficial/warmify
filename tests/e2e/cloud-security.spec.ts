import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('manages write-only cloud tokens and cloud-init scripts', async ({ page }) => {
	await login(page);
	await page.goto('/security/cloud-tokens');
	await expect(page.getByRole('row', { name: /Production Hetzner/ })).toContainText('1');
	expect(await page.content()).not.toContain('cloud-token-list-fixture-secret');

	await page.getByRole('link', { name: 'New cloud token' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Created DigitalOcean');
	await page.getByLabel('Provider').selectOption('digitalocean');
	await page.getByLabel('API token').fill('browser-cloud-token-secret');
	await page.getByRole('button', { name: 'Validate and create token' }).click();
	await expect(page).toHaveURL(/\/security\/cloud-tokens\/cloud-token-created-\d+\/general$/);
	expect(await page.content()).not.toMatch(
		/browser-cloud-token-secret|cloud-token-(?:create-response|detail)-fixture-secret/
	);

	await page.getByLabel('Name', { exact: true }).fill('Renamed DigitalOcean');
	await page.getByRole('button', { name: 'Save token name' }).click();
	await expect(page.getByRole('status')).toHaveText('Cloud token name saved.');
	await page.getByRole('button', { name: 'Validate credential' }).click();
	await expect(page.getByRole('status')).toHaveText('Cloud token is valid.');
	expect(await page.content()).not.toMatch(
		/cloud-token-(?:update-response|validation)-fixture-secret/
	);
	await page.getByRole('link', { name: 'Danger zone' }).click();
	await page.getByLabel(/Type Renamed DigitalOcean/).fill('Renamed DigitalOcean');
	await page.getByRole('button', { name: 'Delete cloud token permanently' }).click();
	await expect(page).toHaveURL('/security/cloud-tokens');

	await page.goto('/security/cloud-init-scripts');
	await expect(page.getByRole('row', { name: /Docker bootstrap/ })).toBeVisible();
	expect(await page.content()).not.toContain('cloud-init-list-fixture-secret');
	await page.getByRole('link', { name: 'New script' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Created bootstrap');
	await page.getByLabel('Script content').fill('#!/bin/sh\necho browser-script-secret');
	await page.getByRole('button', { name: 'Create script' }).click();
	await expect(page).toHaveURL(/\/security\/cloud-init-scripts\/cloud-init-created-\d+\/general$/);
	expect(await page.content()).not.toMatch(
		/browser-script-secret|cloud-init-(?:create-response|detail)-fixture-secret/
	);

	await page.getByLabel('Name', { exact: true }).fill('Renamed bootstrap');
	await page.getByRole('button', { name: 'Save script' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Cloud-init script name saved; the existing content was kept.'
	);
	await page.getByRole('link', { name: 'Danger zone' }).click();
	await page.getByLabel(/Type Renamed bootstrap/).fill('Renamed bootstrap');
	await page.getByRole('button', { name: 'Delete cloud-init script permanently' }).click();
	await expect(page).toHaveURL('/security/cloud-init-scripts');
});
