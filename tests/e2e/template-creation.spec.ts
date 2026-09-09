import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
test('selects a template from the environment and handles rejected creation without losing safe fields', async ({
	page
}) => {
	await login(page);
	await page.goto('/projects/project-1/environments/environment-1');
	await page.getByRole('link', { name: 'New resource', exact: true }).click();
	await page.getByRole('link', { name: /Service template.*One-click service/ }).click();
	await expect(page).toHaveURL(
		'/projects/project-1/environments/environment-1/new/service-template'
	);
	await expect(
		page.getByText('The public API does not provide a browsable catalog.', { exact: false })
	).toBeVisible();
	await page.getByLabel('Template type', { exact: true }).fill('missing-template');
	await page.getByLabel('Server', { exact: true }).selectOption('server-1');
	await page.getByLabel('Name', { exact: true }).fill('Budget');
	await page.getByLabel('Tags (comma-separated)').fill('personal, personal, budget');
	await page.getByLabel('Deploy immediately').uncheck();
	await page.getByRole('button', { name: 'Create resource' }).click();
	await expect(page.getByRole('alert')).toContainText('Template');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Budget');
	await expect(page.getByLabel('Deploy immediately')).not.toBeChecked();
	await expect(page.locator('#template-types option[value="actualbudget"]')).toHaveCount(1);
	expect(await page.content()).not.toContain('template-backend-secret');
	await page.getByLabel('Template type', { exact: true }).fill('actualbudget');
	await page.getByRole('button', { name: 'Create resource' }).click();
	await expect(page).toHaveURL('/services/service-template-created/general');
	expect(await page.content()).not.toContain('template-generated-secret');
});
test('creation pages refuse foreign environments and unsupported resource kinds', async ({
	page
}) => {
	await login(page);
	for (const path of [
		'/projects/project-1/environments/missing-environment/new',
		'/projects/project-1/environments/missing-environment/new/service-template',
		'/projects/project-1/environments/environment-1/new/unsupported-kind'
	]) {
		const response = await page.request.get(path);
		expect(response.status()).toBe(404);
	}
});
