import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
test('project and environment CRUD preserves validation, default production and physical hierarchy', async ({
	page
}) => {
	await login(page);
	await page.goto('/projects');
	await page
		.locator('summary')
		.filter({ hasText: /^New project$/ })
		.click();
	await page.getByLabel('Name', { exact: true }).fill('Reserved project');
	await page.getByLabel('Description', { exact: true }).fill('Keep description');
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect(page.getByText('Choose another project name.')).toBeVisible();
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Keep description');
	await page.getByLabel('Name', { exact: true }).fill('Workflow project');
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Workflow project', exact: true })).toBeVisible();
	const projectUrl = new URL(page.url()).pathname;
	await expect(page.locator('.environment-item')).toHaveCount(1);
	await expect(page.locator('.environment-item')).toContainText('production');
	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(page.getByLabel('Description', { exact: true })).toHaveValue('Keep description');
	await page.getByLabel('Name', { exact: true }).fill('Renamed project');
	await page.getByRole('button', { name: 'Save settings' }).click();
	await expect(page.getByRole('status')).toContainText('saved');
	await expect(page.locator('.breadcrumbs')).toContainText('Renamed project');
	await page.getByRole('link', { name: 'Back to environments' }).click();
	await page
		.locator('summary')
		.filter({ hasText: /^New environment$/ })
		.click();
	await expect(page.getByLabel('Description', { exact: true })).toHaveCount(0);
	await page.getByLabel('Name', { exact: true }).fill('production');
	await page.getByRole('button', { name: 'Create environment', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('already exists');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('production');
	await page.getByLabel('Name', { exact: true }).fill('staging');
	await page.getByRole('button', { name: 'Create environment', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'staging', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New resource', exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await page.getByLabel('Name', { exact: true }).fill('preview');
	await page.getByLabel('Description', { exact: true }).fill('Preview resources');
	await page.getByRole('button', { name: 'Save settings' }).click();
	await expect(page.getByRole('status')).toContainText('saved');
	await expect(page.locator('.breadcrumbs')).toContainText('preview');
	await page.getByRole('link', { name: 'Back to resources' }).click();
	await page.goBack();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('preview');
	await page.getByRole('link', { name: 'Danger zone', exact: true }).click();
	await page.locator('[name="confirmation"]').fill('wrong');
	await page.getByRole('button', { name: 'Delete environment permanently' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await page.locator('[name="confirmation"]').fill('preview');
	await page.getByRole('button', { name: 'Delete environment permanently' }).click();
	await expect(page).toHaveURL(projectUrl);
	await expect(page.locator('.environment-item')).toHaveCount(1);
	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await page.getByRole('link', { name: 'Danger zone', exact: true }).click();
	await page.locator('[name="confirmation"]').fill('Renamed project');
	await page.getByRole('button', { name: 'Delete project permanently' }).click();
	await expect(page).toHaveURL('/projects');
	await expect(page.getByRole('link', { name: /Renamed project/ })).toHaveCount(0);
});
test('populated projects and environments cannot be deleted through their danger routes', async ({
	page
}) => {
	await login(page);
	for (const [path, name, kind] of [
		['/projects/project-1/danger', 'Documentation', 'project'],
		['/projects/project-1/environments/environment-1/danger', 'production', 'environment']
	]) {
		await page.goto(path);
		await page.locator('[name="confirmation"]').fill(name);
		await page.getByRole('button', { name: `Delete ${kind} permanently` }).click();
		await expect(page.getByRole('alert')).toContainText('has resources');
	}
	await page.goto('/projects/project-1/environments/environment-1');
	await expect(page.getByRole('link', { name: 'Website', exact: true })).toBeVisible();
});
