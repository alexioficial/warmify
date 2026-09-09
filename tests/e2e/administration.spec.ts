import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('manages private keys without exposing material before an explicit reveal', async ({
	page
}) => {
	await login(page);
	await page.goto('/security/keys');
	await expect(page.locator('.resource-table tbody tr').first()).toBeVisible();
	expect(await page.content()).not.toContain('private-key-fixture-secret');

	await page.getByRole('link', { name: 'New private key' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Browser key');
	await page.getByLabel('Description').fill('Created by the administration E2E flow');
	await page.getByLabel('Private key', { exact: true }).fill('browser-private-key-secret');
	await page.getByRole('button', { name: 'Create private key' }).click();
	await expect(page).toHaveURL(/\/security\/keys\/key-created-\d+$/);
	expect(await page.content()).not.toContain('browser-private-key-secret');

	await page.getByRole('button', { name: 'Reveal private key' }).click();
	await expect(page.getByLabel('Revealed private key')).toHaveValue('browser-private-key-secret');
	await page.getByRole('button', { name: 'Hide private key' }).click();
	await expect(page.getByLabel('Revealed private key')).toHaveCount(0);
	expect(await page.content()).not.toContain('browser-private-key-secret');

	await page.getByLabel('Name', { exact: true }).fill('Browser key renamed');
	await page.getByRole('button', { name: 'Save private key' }).click();
	await expect(page.getByRole('status')).toContainText('existing key material kept');
	expect(await page.content()).not.toContain('browser-private-key-secret');

	await page.getByLabel(/Type Browser key renamed/).fill('wrong');
	await page.getByRole('button', { name: 'Delete private key' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await page.getByLabel(/Type Browser key renamed/).fill('Browser key renamed');
	await page.getByRole('button', { name: 'Delete private key' }).click();
	await expect(page).toHaveURL('/security/keys');
});

test('shows token-bound team members and manages team shared variables safely', async ({
	page
}) => {
	await login(page);
	await page.goto('/teams');
	await page.locator('.resource-card').filter({ hasText: 'Root Team' }).click();
	await expect(page).toHaveURL('/teams/1');
	await expect(page.getByRole('row', { name: /Admin User/ })).toContainText('admin@example.com');

	await page.getByRole('link', { name: 'Shared variables' }).click();
	await expect(page).toHaveURL('/teams/1/shared-variables');
	await expect(page.getByRole('heading', { name: 'Shared variables' })).toBeVisible();
	expect(await page.content()).not.toContain('team-shared-fixture-secret');

	const existing = page.getByRole('row', { name: /TEAM_REGION/ });
	await existing.getByRole('button', { name: 'Reveal value' }).click();
	await expect(existing.locator('.shared-value')).toHaveText('team-shared-fixture-secret');
	await existing.getByRole('button', { name: 'Hide value' }).click();
	await expect(existing.locator('.shared-value')).toHaveCount(0);

	await page
		.locator('summary')
		.filter({ hasText: /^Add shared variable$/ })
		.click();
	const create = page.locator('form[action="?/createVariable"]');
	await create.getByLabel('Key', { exact: true }).fill('BROWSER_TEAM_KEY');
	await create.getByLabel('Value', { exact: true }).fill('browser-team-secret');
	await create.getByRole('button', { name: 'Add variable' }).click();
	await expect(page.getByRole('status')).toContainText('created');
	expect(await page.content()).not.toContain('browser-team-secret');

	const added = page.getByRole('row', { name: /BROWSER_TEAM_KEY/ });
	await added.getByRole('button', { name: 'Reveal value' }).click();
	await expect(added.locator('.shared-value')).toHaveText('browser-team-secret');
	await added
		.locator('summary')
		.filter({ hasText: /^Delete$/ })
		.click();
	await added.getByLabel(/Type BROWSER_TEAM_KEY/).fill('wrong');
	await added.getByRole('button', { name: 'Delete variable' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await added.getByLabel(/Type BROWSER_TEAM_KEY/).fill('BROWSER_TEAM_KEY');
	await added.getByRole('button', { name: 'Delete variable' }).click();
	await expect(page.getByRole('status')).toContainText('deleted');
	await expect(added).toHaveCount(0);

	const crossOrigin = await page.request.post('/teams/1/shared-variables/reveal', {
		headers: { origin: 'https://other.test' },
		data: { id: '1' }
	});
	expect(crossOrigin.status()).toBe(403);
});
