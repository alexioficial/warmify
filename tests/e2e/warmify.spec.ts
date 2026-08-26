import { expect, test } from '@playwright/test';

test('protects the dashboard and supports login and logout', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login(?:\?|$)/);
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.locator('aside.sidebar')).toBeVisible();
	await expect(page.getByRole('banner').getByText('Root Team')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByText('Documentation')).toBeVisible();
	await expect(page.getByText('Primary server')).toBeVisible();
	await expect(page.getByText('Update documentation')).toBeVisible();
	await expect(page.getByRole('row', { name: /wiki/ })).toContainText('production');
	await expect(page.getByRole('row', { name: /wiki/ })).toContainText('Primary server');
	await expect(page.locator('article.project-item')).toContainText('1 env');
	await expect(page.locator('article.project-item')).toContainText('1 resource');
	await expect(page.locator('main pre')).toHaveCount(0);
	const removedManageRoute = await page.request.get('/manage/projects');
	expect(removedManageRoute.status()).toBe(404);
	const fontFamily = await page
		.locator('body')
		.evaluate((body) => getComputedStyle(body).fontFamily);
	expect(fontFamily.toLowerCase()).not.toContain('system-ui');
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL(/\/login$/);
});

test('navigates a project and manages a resource through contextual screens', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
	await expect(page.getByPlaceholder('Search projects')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
	await page.getByRole('link', { name: 'Documentation' }).click();
	await expect(page).toHaveURL(/\/projects\/project-1$/);
	await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'production' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Website' })).toBeVisible();
	await expect(page.locator('article.environment-panel')).toContainText('Application');
	await expect(page.getByText('running:healthy')).toHaveCount(0);

	await page.getByRole('link', { name: 'New resource' }).click();
	await expect(page).toHaveURL(/\/projects\/project-1\/new$/);
	await expect(page.getByRole('heading', { name: 'New resource' })).toBeVisible();
	await page.getByLabel('Environment').selectOption('environment-1');
	await page.locator('select[name="server_uuid"]').selectOption('server-1');
	await page.getByLabel('Name').fill('Image App');
	await page.locator('input[name="docker_registry_image_name"]').fill('nginx');
	await page.locator('input[name="ports_exposes"]').fill('80');
	await page.getByRole('button', { name: 'Create resource' }).click();

	await expect(page).toHaveURL(/\/applications\/app-2$/);
	await expect(page.getByRole('heading', { name: 'Image App' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Resource settings' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Application details' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Build pipeline' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Networking' })).toBeVisible();
	await expect(page.getByText('Container started')).toBeVisible();
	await expect(page.getByText('Manage through API operations')).toHaveCount(0);
	await page.getByRole('button', { name: 'Start', exact: true }).click();
	await expect(page.getByText('Start requested')).toBeVisible();
});

test('presents infrastructure collections with family-specific columns', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByRole('link', { name: 'Servers', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Servers', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('columnheader', { name: 'Address' })).toBeVisible();
	await expect(page.getByRole('row', { name: /Primary server/ })).toContainText('10.0.0.1');

	await page.getByRole('link', { name: 'Sources', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Sources', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('columnheader', { name: 'Provider' })).toBeVisible();
	await expect(page.getByRole('row', { name: /widube/ })).toContainText('GitHub');
	await expect(page.getByRole('row', { name: /widube/ })).toContainText('Connected');
});
