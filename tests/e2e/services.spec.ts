import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('service configuration, domains, nested resources, history and redaction', async ({
	page
}) => {
	await login(page);
	await page.goto('/services/service-config');
	await expect(page).toHaveURL(/\/services\/service-config\/general$/);
	await page.getByLabel('Description', { exact: true }).fill('Updated stack');
	await page.getByRole('button', { name: 'Save general' }).click();
	await expect(page.getByRole('status')).toContainText('Configuration saved');
	const html = await page.content();
	expect(html).not.toContain('service-compose-secret');
	expect(html).not.toContain('rendered-compose-secret');
	await page
		.getByRole('navigation', { name: 'Service settings' })
		.getByRole('link', { name: 'Domains' })
		.click();
	await page.getByLabel('Frontend URLs').fill('https://conflict.example.com');
	await page.getByRole('button', { name: 'Save domains' }).click();
	await expect(page.getByRole('button', { name: 'Confirm domain override' })).toBeVisible();
	await expect(page.getByLabel('Frontend URLs')).toHaveValue('https://conflict.example.com');
	await page.getByRole('button', { name: 'Confirm domain override' }).click();
	await expect(page.getByRole('status')).toContainText('Domains saved');
	await page
		.getByRole('navigation', { name: 'Service settings' })
		.getByRole('link', { name: 'Service resources', exact: true })
		.click();
	await page.getByRole('link', { name: 'Frontend', exact: true }).click();
	await expect(
		page
			.getByRole('navigation', { name: 'Service settings' })
			.getByRole('link', { name: 'Service resources', exact: true })
	).toHaveAttribute('aria-current', 'page');
	await page.getByLabel('Display name').fill('Frontend updated');
	await page.getByRole('button', { name: 'Save configuration' }).click();
	await expect(page.getByRole('heading', { name: 'Frontend updated' })).toBeVisible();
	await page.getByRole('link', { name: 'Runtime logs for this container' }).click();
	await expect(page.locator('.log-output')).toContainText('web: ready');
	await page.getByRole('combobox', { name: 'Container', exact: true }).selectOption('db');
	await page.getByRole('button', { name: 'Load logs' }).click();
	await expect(page).toHaveURL(/sub_service_name=db/);
	await expect(page.locator('.log-output')).toContainText('db: ready');
	await page.goBack();
	await expect(page.locator('.log-output')).toContainText('web: ready');
});

test('service variables, container storage and scheduled tasks', async ({ page }) => {
	await login(page);
	await page.goto('/services/service-data/environment-variables');
	expect(await page.content()).not.toContain('service-env-secret');
	await expect(page.getByRole('columnheader', { name: 'Buildtime' })).toHaveCount(0);
	await page.getByText('Add variable', { exact: true }).first().click();
	const create = page.locator('form[action="?/createVariable"]');
	await create.getByLabel('Key', { exact: true }).fill('MODE');
	await create.getByLabel('Value', { exact: true }).fill('private-mode');
	await create.getByRole('button', { name: 'Add variable' }).click();
	await expect(page.getByRole('row', { name: /MODE/ })).toBeVisible();
	expect(await page.content()).not.toContain('private-mode');
	await page.goto('/services/service-data/persistent-storage');
	await page
		.locator('summary')
		.filter({ hasText: /^Add storage$/ })
		.click();
	const storage = page.locator('form[action="?/createStorage"]');
	await storage
		.getByRole('combobox', { name: 'Container', exact: true })
		.selectOption('service-data-web');
	await storage.locator('[name="name"]').fill('uploads');
	await storage.locator('[name="mount_path"]').fill('/uploads');
	await storage.getByRole('button', { name: 'Add storage' }).click();
	await expect(page.getByRole('row', { name: /uploads/ }).first()).toBeVisible();
	await page.goto('/services/service-data/scheduled-tasks');
	await page
		.locator('summary')
		.filter({ hasText: /^Add task$/ })
		.click();
	const task = page.locator('form[action="?/createTask"]');
	await task.getByLabel('Name', { exact: true }).fill('Cleanup service');
	await task.getByLabel('Command', { exact: true }).fill('echo cleanup');
	await task.getByRole('button', { name: 'Add task' }).click();
	const row = page.getByRole('row', { name: /Cleanup service/ }).first();
	await expect(row).toBeVisible();
	await row
		.locator('summary')
		.filter({ hasText: /^Run now$/ })
		.click();
	await row
		.locator('form[action="?/executeTask"] input[name="confirmation"]')
		.fill('run Cleanup service');
	await row.locator('form[action="?/executeTask"] button').click();
	await expect(page.getByRole('status')).toContainText('execution queued');
	await expect(page.getByRole('row', { name: /Cleanup service/ }).first()).toContainText('success');
});

test('service tags and confirmed clone, move, migrate, deletion', async ({ page }) => {
	await login(page);
	await page.goto('/services/service-ops/tags');
	await page.getByLabel('Tag names').fill('production');
	await page.getByRole('button', { name: 'Add tags' }).click();
	await page
		.locator('summary')
		.filter({ hasText: /^production$/ })
		.click();
	await page.locator('form[action="?/deleteTag"] input[name="confirmation"]').fill('production');
	await page.getByRole('button', { name: 'Remove tag' }).click();
	await expect(page.getByText('No tags attached.')).toBeVisible();
	await page.goto('/services/service-ops/resource-operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Clone service$/ })
		.click();
	const clone = page
		.locator('details')
		.filter({ has: page.getByRole('button', { name: 'Clone service', exact: true }) });
	await clone
		.getByRole('combobox', { name: 'Destination', exact: true })
		.selectOption('destination-1');
	await clone.locator('[name="name"]').fill('Stack copy');
	await clone.locator('[name="confirmation"]').fill('clone Demo Stack');
	await clone.getByRole('button', { name: 'Clone service' }).click();
	await expect(page.getByRole('heading', { name: 'Stack copy', exact: true })).toBeVisible();
	await page.goto('/services/service-ops/resource-operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Move to environment$/ })
		.click();
	const move = page
		.locator('details')
		.filter({ has: page.getByRole('button', { name: 'Move service', exact: true }) });
	await move
		.getByRole('combobox', { name: 'Environment', exact: true })
		.selectOption('environment-1');
	await move.locator('[name="confirmation"]').fill('move Demo Stack');
	await move.getByRole('button', { name: 'Move service' }).click();
	await expect(page).toHaveURL(/\/service-ops\/general$/);
	await page.goto('/services/service-ops/resource-operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Migrate to server$/ })
		.click();
	const migrate = page
		.locator('details')
		.filter({ has: page.getByRole('button', { name: 'Migrate service', exact: true }) });
	await migrate
		.getByRole('combobox', { name: 'Destination', exact: true })
		.selectOption('destination-1');
	await migrate.locator('[name="confirmation"]').fill('migrate Demo Stack');
	await migrate.getByRole('button', { name: 'Migrate service' }).click();
	await expect(page.getByRole('status')).toContainText('migrate requested');
	await page.goto('/services/service-ops/danger');
	await page.getByRole('textbox', { name: /Type Demo Stack or service-ops/ }).fill('Demo Stack');
	await page.getByRole('button', { name: 'Delete service permanently' }).click();
	await expect(page).toHaveURL(/\/projects$/);
});

test('nested service database configuration and volume backups', async ({ page }) => {
	await login(page);
	await page.goto('/services/service-backups/databases/service-backups-db');
	await page.getByLabel('Display name', { exact: true }).fill('Main database');
	await page.getByLabel('Public port', { exact: true }).fill('15432');
	await page.getByRole('button', { name: 'Save configuration' }).click();
	await expect(page.getByRole('heading', { name: 'Main database', exact: true })).toBeVisible();
	await expect(page.getByLabel('Public port', { exact: true })).toHaveValue('15432');
	await page.getByRole('link', { name: 'Runtime logs for this container' }).click();
	await expect(page.locator('.log-output')).toContainText('db: ready');
	await page.goto('/services/service-backups/backups');
	const row = page.getByRole('row', { name: /stack-data/ }).first();
	await row
		.locator('summary')
		.filter({ hasText: /^Backup schedule$/ })
		.click();
	await row.getByRole('button', { name: 'Save backup schedule' }).click();
	await expect(page.getByRole('status')).toContainText('Backup schedule saved');
	await row
		.locator('summary')
		.filter({ hasText: /^Back up now$/ })
		.click();
	await row.locator('form[action="?/runBackup"] input[name="confirmation"]').fill('run backup');
	await row.getByRole('button', { name: 'Queue backup' }).click();
	await expect(page.getByRole('status')).toContainText('Storage backup queued');
});
