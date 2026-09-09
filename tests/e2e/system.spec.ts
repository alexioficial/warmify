import { expect, test } from '@playwright/test';

test('shows system health and safely gates root-only API and MCP controls', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.goto('/system');
	await expect(page.getByRole('heading', { name: 'System' })).toBeVisible();
	await expect(page.getByText('OK', { exact: true })).toBeVisible();
	await expect(page.getByText('4.2.0', { exact: true })).toBeVisible();
	await expect(page.getByText('Reachable', { exact: true })).toBeVisible();
	await expect(page.getByText('Not available', { exact: true })).toBeVisible();
	await expect(page.getByText(/Warmify depends on this API/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Enable API' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Disable API' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Enable MCP' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Disable MCP' })).toBeDisabled();
});
