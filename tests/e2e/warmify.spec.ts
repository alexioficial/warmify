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
	await expect(page.getByText('Documentation', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Primary server', exact: true })).toBeVisible();
	await expect(page.getByText('Update documentation')).toBeVisible();
	await expect(page.getByRole('row', { name: /wiki/ })).toContainText('production');
	await expect(page.getByRole('row', { name: /wiki/ })).toContainText('Primary server');
	const projectCard = page.getByRole('link', { name: /Documentation.*1 env.*1 resource/ });
	await expect(projectCard).toContainText('1 env');
	await expect(projectCard).toContainText('1 resource');
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

test('navigates the project, environment, and resource hierarchy', async ({ page }) => {
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
	await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();
	await page.getByRole('link', { name: 'production' }).click();
	await expect(page).toHaveURL(/\/projects\/project-1\/environments\/environment-1$/);
	const resourceRow = page.getByRole('row', { name: /Website/ });
	await expect(resourceRow).toContainText('Application');
	await resourceRow.click();
	await expect(page).toHaveURL(/\/applications\/app-1\/general$/);
	await expect(page.getByRole('heading', { name: 'Website' })).toBeVisible();
});

test('uses physical application routes with project breadcrumbs and browser history', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.goto('/applications/app-2/general');
	await expect(page.getByRole('heading', { name: 'Image App' })).toBeVisible();
	const breadcrumbs = page.getByRole('banner').getByRole('link');
	await expect(breadcrumbs.filter({ hasText: 'Projects' })).toHaveAttribute('href', '/projects');
	await expect(breadcrumbs.filter({ hasText: 'Documentation' })).toHaveAttribute(
		'href',
		'/projects/project-1'
	);
	await expect(breadcrumbs.filter({ hasText: 'production' })).toHaveAttribute(
		'href',
		'/projects/project-1/environments/environment-1'
	);
	await expect(breadcrumbs.filter({ hasText: 'Image App' })).toHaveAttribute(
		'href',
		'/applications/app-2/general'
	);

	const applicationNav = page.getByRole('navigation', { name: 'Application settings' });
	await expect(applicationNav.getByRole('link', { name: 'General', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(applicationNav.getByRole('link', { name: 'Git source' })).toHaveCount(0);
	await expect(applicationNav.getByRole('link', { name: 'Preview deployments' })).toBeVisible();
	await expect(applicationNav.getByRole('link', { name: 'Terminal' })).toHaveCount(0);
	await expect(applicationNav.getByRole('link', { name: 'Metrics' })).toHaveCount(0);

	await applicationNav.getByRole('link', { name: 'Domains' }).click();
	await expect(page).toHaveURL(/\/applications\/app-2\/domains$/);
	await expect(page.getByRole('heading', { name: 'Domains' })).toBeVisible();
	await expect(applicationNav.getByRole('link', { name: 'Domains' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.goBack();
	await expect(page).toHaveURL(/\/applications\/app-2\/general$/);
	await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
	await page.goForward();
	await expect(page).toHaveURL(/\/applications\/app-2\/domains$/);
	await expect(page.getByRole('heading', { name: 'Domains' })).toBeVisible();

	let releaseProjectsRequest = () => {};
	const projectsRequestGate = new Promise<void>((resolve) => {
		releaseProjectsRequest = resolve;
	});
	await page.route('**/projects/__data.json*', async (route) => {
		await projectsRequestGate;
		await route.continue();
	});
	const projectsNavigation = page
		.getByRole('banner')
		.getByRole('link', { name: 'Projects' })
		.click();
	try {
		await expect(page.getByRole('region', { name: 'Loading page' })).toBeVisible();
	} finally {
		releaseProjectsRequest();
	}
	await projectsNavigation;
	await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Loading page' })).toHaveCount(0);
});

test('edits typed application configuration without exposing or preserving secrets', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.goto('/applications/app-2/runtime');
	await expect(page.getByRole('heading', { name: 'Runtime' })).toBeVisible();
	await expect(page.getByLabel('Maximum restart count')).toHaveValue('3');
	await page.getByLabel('Custom Docker run options').fill('--memory 1g');
	await page.getByLabel('Maximum restart count').fill('5');
	await page.getByLabel('Consistent container name').check();
	await expect(page.getByLabel('Custom Docker run options')).toHaveValue('--memory 1g');
	await expect(page.getByLabel('Maximum restart count')).toHaveValue('5');
	await page.getByRole('button', { name: 'Save runtime' }).click();
	await expect(page.getByRole('status')).toHaveText('Configuration saved');
	await expect(page.getByLabel('Maximum restart count')).toHaveValue('5');
	await expect(page.getByLabel('Consistent container name')).toBeChecked();

	await page.getByLabel('Custom Docker run options').fill('  --memory 2g  ');
	await page.getByLabel('Maximum restart count').fill('13');
	await page.getByRole('button', { name: 'Save runtime' }).click();
	await expect(page.getByText('Unlucky restart count.')).toBeVisible();
	await expect(page.getByLabel('Custom Docker run options')).toHaveValue('--memory 2g');
	await expect(page.getByLabel('Maximum restart count')).toHaveValue('13');

	await page.goto('/applications/app-2/security');
	const password = page.getByLabel('HTTP basic auth password');
	await expect(password).toHaveValue('');
	await expect(page.locator('body')).not.toContainText('root-password-secret');
	await password.fill('new-password-secret');
	await page.getByRole('button', { name: 'Save security' }).click();
	await expect(page.getByRole('status')).toHaveText('Configuration saved');
	await expect(password).toHaveValue('');
	await expect(page.locator('body')).not.toContainText('new-password-secret');
});

test('manages structured domains and presents public API access details', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.goto('/applications/app-2/access');
	await expect(page.getByRole('heading', { name: 'Public access' })).toBeVisible();
	await expect(page.getByText('2 configured domains')).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: 'coolify' })).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: '80,443' })).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: '8080:80' })).toBeVisible();
	await expect(page.getByRole('definition').filter({ hasText: 'image-app,web' })).toBeVisible();
	await expect(page.getByText('Unavailable through the public API')).toBeVisible();

	await page.getByRole('link', { name: 'Manage domains' }).click();
	await expect(page).toHaveURL(/\/applications\/app-2\/domains$/);
	const domains = page.locator('input[name="domain"]');
	await expect(domains).toHaveCount(2);
	await expect(domains.nth(0)).toHaveValue('https://image.example.com');
	await expect(domains.nth(1)).toHaveValue('http://preview.image.example.com/path');
	await expect(page.locator('input[name="noindex_index"]').nth(1)).toBeChecked();
	await expect(page.getByLabel('Redirect behavior')).toHaveValue('non-www');
	await expect(page.getByLabel('Force HTTPS')).toBeChecked();

	await domains.nth(1).fill('https://image.example.com');
	await page.getByRole('button', { name: 'Save domains', exact: true }).click();
	await expect(page.getByText('This domain is already listed.')).toBeVisible();
	await expect(domains.nth(0)).toHaveValue('https://image.example.com');
	await expect(domains.nth(1)).toHaveValue('https://image.example.com');

	await domains.nth(0).fill('https://docs.example.com');
	await page.getByRole('button', { name: 'Remove' }).nth(1).click();
	await page.getByRole('button', { name: 'Add domain' }).click();
	await domains.nth(1).fill('https://search-disabled.example.com');
	await page.locator('input[name="noindex_index"]').nth(1).check();
	await page.getByLabel('Redirect behavior').selectOption('www');
	await page.getByLabel('Force HTTPS').uncheck();
	await page.getByRole('button', { name: 'Save domains', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Domains saved');
	await page.reload();
	await expect(domains).toHaveCount(2);
	await expect(domains.nth(0)).toHaveValue('https://docs.example.com');
	await expect(domains.nth(1)).toHaveValue('https://search-disabled.example.com');
	await expect(page.locator('input[name="noindex_index"]').nth(1)).toBeChecked();

	await domains.nth(0).fill('https://conflict.example.com');
	await page.getByRole('button', { name: 'Save domains', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Domain conflicts' })).toBeVisible();
	await expect(page.getByText('Existing site')).toBeVisible();
	await page.getByRole('button', { name: 'Save despite conflicts' }).click();
	await expect(page.getByRole('status')).toHaveText('Domains saved');
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
