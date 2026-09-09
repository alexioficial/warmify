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
	const deployment = page.getByRole('row', { name: /Update documentation/ });
	await expect(deployment).toContainText('Primary server');
	await expect(deployment.getByRole('link', { name: 'Update documentation' })).toHaveAttribute(
		'href',
		'/deployments/deploy-1'
	);
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

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
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

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
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

test('manages application environment variables without exposing their values in SSR', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/environment-variables');
	await expect(page.getByRole('heading', { name: 'Environment variables' })).toBeVisible();
	await expect(page.getByRole('row', { name: /DATABASE_URL/ })).toContainText('[REDACTED]');
	await expect(page.locator('body')).not.toContainText('postgres://production-secret');

	const addPanel = page.locator('details').filter({ hasText: 'Add variable' });
	await addPanel.locator('summary').click();
	await addPanel.getByLabel('Key').fill('API_TOKEN');
	await addPanel.getByLabel('Value').fill('first-api-secret');
	await addPanel.getByLabel('Comment').fill('API credential');
	await addPanel.getByLabel('Buildtime').uncheck();
	await addPanel.getByRole('button', { name: 'Add variable' }).click();
	await expect(page.getByRole('status')).toHaveText('Variable API_TOKEN created');
	await expect(page.locator('body')).not.toContainText('first-api-secret');

	const createdRow = page.getByRole('row', { name: /API_TOKEN/ });
	await expect(createdRow).toContainText('API credential');
	await expect(createdRow).toContainText('No');
	const editPanel = createdRow.locator('details').filter({ hasText: 'Edit' });
	await editPanel.locator('summary').click();
	await editPanel.getByLabel('Replacement value').fill('second-api-secret');
	await editPanel.getByLabel('Runtime').uncheck();
	await editPanel.getByRole('button', { name: 'Save variable' }).click();
	await expect(page.getByRole('status')).toHaveText('Variable API_TOKEN updated');
	await expect(page.locator('body')).not.toContainText('second-api-secret');

	const bulkPanel = page.locator('details').filter({ hasText: 'Bulk upsert' });
	await bulkPanel.locator('summary').click();
	await bulkPanel.getByLabel('Production').fill('CACHE_URL=redis://cache-secret');
	await bulkPanel.getByLabel('Preview deployments').fill('CACHE_URL=redis://preview-cache-secret');
	await bulkPanel.getByRole('button', { name: 'Upsert variables' }).click();
	await expect(page.getByRole('status')).toHaveText('2 variables upserted');
	await expect(page.getByRole('row', { name: /CACHE_URL.*Production/ })).toBeVisible();
	await expect(page.getByRole('row', { name: /CACHE_URL.*Preview/ })).toBeVisible();
	await expect(page.locator('body')).not.toContainText('cache-secret');

	const deleteRow = page.getByRole('row', { name: /API_TOKEN/ });
	const deletePanel = deleteRow.locator('details').filter({ hasText: 'Delete' });
	await deletePanel.locator('summary').click();
	await deletePanel.getByLabel(/Type API_TOKEN to confirm/).fill('API_TOKEN');
	await deletePanel.getByRole('button', { name: 'Delete variable' }).click();
	await expect(page.getByRole('status')).toHaveText('Variable API_TOKEN deleted');
	await expect(page.getByRole('row', { name: /API_TOKEN/ })).toHaveCount(0);
});

test('manages application storage and confirmed volume backups without exposing file content', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/persistent-storage');
	await expect(page.getByRole('heading', { name: 'Persistent storage' })).toBeVisible();
	await expect(page.getByRole('row', { name: /app-2-data/ })).toContainText('Persistent volume');
	await expect(page.getByRole('row', { name: /config.json/ })).toContainText('Managed file');
	await expect(page.locator('body')).not.toContainText('mock-secret-content');

	const addPanel = page.locator('details').filter({ hasText: 'Add storage' });
	await addPanel.locator('summary').click();
	await addPanel.getByLabel('Storage type').selectOption('directory');
	await addPanel.getByLabel('Destination path inside the container').fill('/uploads');
	await addPanel.getByLabel('Source path on the server').fill('/srv/e2e-uploads');
	await addPanel.getByRole('button', { name: 'Add storage' }).click();
	await expect(page.getByRole('status')).toHaveText('Storage created');

	let storageRow = page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' });
	await expect(storageRow).toContainText('Directory mount');
	await expect(storageRow).toContainText('Available; state not exposed');

	const editPanel = storageRow.locator('details').filter({ hasText: 'Edit' });
	await editPanel.locator('summary').click();
	await editPanel.getByLabel('Mount path').fill('/data/uploads');
	await editPanel.getByRole('button', { name: 'Save storage' }).click();
	await expect(page.getByRole('status')).toHaveText('Storage updated');
	storageRow = page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' });
	await expect(storageRow).toContainText('/data/uploads');

	const schedulePanel = storageRow
		.locator('summary')
		.filter({ hasText: /^Backup schedule$/ })
		.locator('..');
	await schedulePanel.locator('summary').click();
	await schedulePanel.getByLabel('Frequency').fill('0 3 * * *');
	await schedulePanel.getByLabel('Save to S3', { exact: true }).check();
	await schedulePanel.getByLabel('S3 storage').selectOption('s3-1');
	await expect(schedulePanel.getByLabel('S3 storage').locator('option')).toHaveCount(2);
	await schedulePanel.getByRole('button', { name: 'Save backup schedule' }).click();
	await expect(page.getByRole('status')).toHaveText('Backup schedule saved');

	storageRow = page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' });
	const runPanel = storageRow.locator('details').filter({ hasText: 'Back up now' });
	await runPanel.locator('summary').click();
	await runPanel.getByLabel(/Type run backup to confirm/).fill('run backup');
	await runPanel.getByRole('button', { name: 'Queue backup' }).click();
	await expect(page.getByRole('status')).toHaveText('Storage backup queued');

	storageRow = page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' });
	const deleteSchedulePanel = storageRow
		.locator('details')
		.filter({ hasText: 'Delete backup schedule' });
	await deleteSchedulePanel.locator('summary').click();
	await deleteSchedulePanel
		.getByLabel(/Type \/srv\/e2e-uploads to confirm/)
		.fill('/srv/e2e-uploads');
	await deleteSchedulePanel.getByRole('button', { name: 'Delete schedule and archives' }).click();
	await expect(page.getByRole('status')).toHaveText('Backup schedule and archives deleted');

	storageRow = page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' });
	const deletePanel = storageRow.locator('details').filter({ hasText: 'Delete storage' });
	await deletePanel.locator('summary').click();
	await deletePanel.getByLabel(/Type \/srv\/e2e-uploads to confirm/).fill('/srv/e2e-uploads');
	await deletePanel.getByRole('button', { name: 'Delete storage' }).click();
	await expect(page.getByRole('status')).toHaveText('Storage deleted');
	await expect(page.getByRole('row').filter({ hasText: '/srv/e2e-uploads' })).toHaveCount(0);
});

test('configures Git source discovery, resource limits, and write-only webhook secrets', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-1/git-source');
	const discovery = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Repository discovery' }) });
	await discovery.getByLabel('GitHub App').selectOption('7');
	await discovery.getByRole('button', { name: 'Load repository options' }).click();
	await discovery.getByLabel('Repository').selectOption('widube/api');
	await discovery.getByRole('button', { name: 'Load repository options' }).click();
	const source = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Git source', exact: true }) });
	await expect(source.getByLabel('Repository')).toHaveValue('widube/api');
	await source.getByLabel('Branch').selectOption('develop');
	await source.getByRole('button', { name: 'Save Git source' }).click();
	await expect(page.getByRole('status')).toHaveText('Configuration saved');
	await page.reload();
	await expect(source.getByLabel('Repository')).toHaveValue('widube/api');
	await expect(source.getByLabel('Branch')).toHaveValue('develop');
	await expect(page.locator('body')).not.toContainText('do-not-leak');

	await page.goto('/applications/app-2/resource-limits');
	await page.getByLabel('Memory limit').fill('512m');
	await page.getByLabel('Memory swappiness').fill('60');
	await page.getByLabel('CPU limit').fill('0.5');
	await page.getByRole('button', { name: 'Save resource limits' }).click();
	await expect(page.getByRole('status')).toHaveText('Configuration saved');
	await page.reload();
	await expect(page.getByLabel('Memory limit')).toHaveValue('512m');
	await expect(page.getByLabel('Memory swappiness')).toHaveValue('60');
	await expect(page.getByLabel('CPU limit')).toHaveValue('0.5');

	await page.goto('/applications/app-2/webhooks');
	await page.getByLabel('GitHub webhook secret').fill('new-webhook-secret');
	await page.getByRole('button', { name: 'Save manual webhook secrets' }).click();
	await expect(page.getByRole('status')).toHaveText('Configuration saved');
	await expect(page.locator('body')).not.toContainText('new-webhook-secret');
	await page.reload();
	await expect(page.getByLabel('GitHub webhook secret')).toHaveValue('');
	await expect(page.locator('body')).not.toContainText('new-webhook-secret');
});

test('manages application destinations, tags, and confirmed rollback', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/destinations');
	await expect(page.getByRole('row', { name: /Primary destination/ })).toContainText('Primary');
	const addDestination = page.locator('details').filter({ hasText: 'Add destination' });
	await addDestination.locator('summary').click();
	await addDestination.getByLabel('Destination').selectOption('destination-2');
	await addDestination.getByRole('button', { name: 'Attach destination' }).click();
	await expect(page.getByRole('status')).toHaveText('Destination attached');
	const destinationRow = page.getByRole('row', { name: /Secondary destination/ });
	await expect(destinationRow).toContainText('Additional');
	const removeDestination = destinationRow.locator('details').filter({ hasText: 'Remove' });
	await removeDestination.locator('summary').click();
	await removeDestination
		.getByLabel(/Type Secondary destination to confirm/)
		.fill('Secondary destination');
	await removeDestination.getByRole('button', { name: 'Remove destination' }).click();
	await expect(page.getByRole('status')).toHaveText('Destination detached');
	await expect(page.getByRole('row', { name: /Secondary destination/ })).toHaveCount(0);

	await page.goto('/applications/app-2/tags');
	const addTags = page.locator('details').filter({ hasText: 'Add tags' });
	await addTags.locator('summary').click();
	await addTags.getByLabel('Tag names').fill('customer-facing, staging');
	await addTags.getByRole('button', { name: 'Add tags' }).click();
	await expect(page.getByRole('status')).toHaveText('Tags added');
	const tagRow = page.getByRole('row', { name: /staging/ });
	const removeTag = tagRow.locator('details').filter({ hasText: 'Remove' });
	await removeTag.locator('summary').click();
	await removeTag.getByLabel(/Type staging to confirm/).fill('staging');
	await removeTag.getByRole('button', { name: 'Remove tag' }).click();
	await expect(page.getByRole('status')).toHaveText('Tag staging removed');
	await expect(page.getByRole('row', { name: /staging/ })).toHaveCount(0);

	await page.goto('/applications/app-2/rollback');
	await expect(page.getByRole('row', { name: /current-sha/ })).toContainText('Current');
	const rollbackRow = page.getByRole('row', { name: /previous-sha/ });
	const rollback = rollbackRow.locator('details');
	await rollback.locator('summary').click();
	await rollback.getByLabel(/Type rollback previous-sha to confirm/).fill('rollback previous-sha');
	await rollback.getByRole('button', { name: 'Queue rollback' }).click();
	await expect(page.getByRole('status')).toHaveText('Rollback deployment queued.');
	await expect(page.getByRole('link', { name: 'Open rollback deployment' })).toHaveAttribute(
		'href',
		'/deployments/rollback-deploy-1'
	);
});

test('clones, moves, migrates, and permanently deletes applications with confirmation', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/resource-operations');
	let operation = page.locator('details').filter({ hasText: 'Clone application' });
	await operation.locator('summary').click();
	await operation.getByLabel('Destination').selectOption('destination-2');
	await operation.getByLabel('New name').fill('Cloned Image App');
	await operation.getByLabel(/Type clone Image App to confirm/).fill('clone Image App');
	await operation.getByRole('button', { name: 'Clone application' }).click();
	await expect(page).toHaveURL(/\/applications\/app-cloned\/general$/);
	await expect(page.getByRole('heading', { name: 'Cloned Image App' })).toBeVisible();

	await page.goto('/applications/app-2/resource-operations');
	operation = page.locator('details').filter({ hasText: 'Move to environment' });
	await operation.locator('summary').click();
	await operation.getByLabel('Environment').selectOption('environment-1');
	await operation.getByLabel(/Type move Image App to confirm/).fill('move Image App');
	await operation.getByRole('button', { name: 'Move application' }).click();
	await expect(page).toHaveURL(/\/applications\/app-2\/general$/);

	await page.goto('/applications/app-2/resource-operations');
	operation = page.locator('details').filter({ hasText: 'Migrate to server' });
	await operation.locator('summary').click();
	await operation.getByLabel('Destination').selectOption('destination-2');
	await operation.getByLabel(/Type migrate Image App to confirm/).fill('migrate Image App');
	await operation.getByRole('button', { name: 'Migrate application' }).click();
	await expect(page.getByRole('status')).toHaveText('Application migration started.');

	await page.goto('/applications/app-delete/danger');
	await page.getByLabel(/Type Disposable App or app-delete to confirm/).fill('Disposable App');
	await page.getByRole('button', { name: 'Delete application permanently' }).click();
	await expect(page).toHaveURL(/\/applications$/);
});

test('manages scheduled tasks, confirmed execution, and execution history', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/scheduled-tasks');
	await expect(page.getByRole('heading', { name: 'Scheduled tasks' })).toBeVisible();
	const existingRow = page.getByRole('row', { name: /Cleanup/ });
	await expect(existingRow).toContainText('0 2 * * *');
	await expect(existingRow).toContainText('success');

	const addPanel = page.locator('details').filter({ hasText: 'Add task' });
	await addPanel.locator('summary').click();
	await addPanel.getByLabel('Name').fill('Prune cache');
	await addPanel.getByLabel('Schedule').fill('0 * * * *');
	await addPanel.getByLabel('Timeout (seconds)').fill('120');
	await addPanel.getByLabel('Command').fill('php artisan cache:prune');
	await addPanel.getByRole('button', { name: 'Add task' }).click();
	await expect(page.getByRole('status')).toHaveText('Scheduled task created');

	let taskRow = page.getByRole('row', { name: /Prune cache/ });
	await expect(taskRow).toContainText('Not run yet');
	const editPanel = taskRow.locator('details').filter({ hasText: /^Edit/ });
	await editPanel.locator('summary').click();
	await editPanel.getByLabel('Schedule').fill('15 * * * *');
	await editPanel.getByLabel('Timeout (seconds)').fill('180');
	await editPanel.getByLabel('Enabled').uncheck();
	await editPanel.getByRole('button', { name: 'Save task' }).click();
	await expect(page.getByRole('status')).toHaveText('Scheduled task updated');

	taskRow = page.getByRole('row', { name: /Prune cache/ });
	await expect(taskRow).toContainText('15 * * * *');
	await expect(taskRow).toContainText('180s');
	await expect(taskRow).toContainText('Disabled');
	const runPanel = taskRow.locator('details').filter({ hasText: /^Run now/ });
	await runPanel.locator('summary').click();
	await runPanel.getByLabel(/Type run Prune cache to confirm/).fill('run Prune cache');
	await runPanel.getByRole('button', { name: 'Queue execution' }).click();
	await expect(page.getByRole('status')).toHaveText('Scheduled task execution queued');

	taskRow = page.getByRole('row', { name: /Prune cache/ });
	await expect(taskRow).toContainText('success');
	const historyPanel = taskRow.locator('details').filter({ hasText: /^History/ });
	await historyPanel.locator('summary').click();
	await expect(historyPanel).toContainText('Task completed');
	await expect(historyPanel).toContainText('0.75s');

	const deletePanel = taskRow.locator('details').filter({ hasText: /^Delete/ });
	await deletePanel.locator('summary').click();
	await deletePanel.getByLabel(/Type Prune cache to confirm deletion/).fill('Prune cache');
	await deletePanel.getByRole('button', { name: 'Delete task' }).click();
	await expect(page.getByRole('status')).toHaveText('Scheduled task deleted');
	await expect(page.getByRole('row', { name: /Prune cache/ })).toHaveCount(0);
});

test('groups and polls application deployments and retries bounded runtime logs', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/applications/app-2/deployments');
	await expect(page.getByRole('heading', { name: 'Active (1)' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Queued (1)' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Completed (1)' })).toBeVisible();

	await expect(page.getByRole('heading', { name: /^Active/ })).toHaveCount(0, { timeout: 10_000 });
	await expect(page.getByRole('heading', { name: 'Completed (3)' })).toBeVisible();
	const deploymentLink = page.getByRole('link', { name: /Deploy the current image/ });
	await expect(deploymentLink).toHaveAttribute('href', '/deployments/app-deploy-active');
	await deploymentLink.click();
	await expect(page).toHaveURL(/\/deployments\/app-deploy-active$/);
	await expect(page.getByRole('heading', { name: 'Image App' })).toBeVisible();

	await page.goto('/applications/app-2/runtime-logs');
	const logOutput = page.locator('.log-output');
	await expect(logOutput).toContainText('Tail: 100');

	const lines = page.getByLabel('Lines');
	await lines.selectOption('250');
	await expect(page.getByRole('alert')).toContainText('Coolify refresh failed.');
	await expect(page.getByRole('alert')).toContainText('retry in 7 seconds');
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(logOutput).toContainText('Tail: 250');

	await lines.selectOption('500');
	await expect(page.getByRole('alert')).toContainText('Coolify refresh failed.');
	await page.getByRole('button', { name: 'Retry' }).click();
	await expect(logOutput).toContainText('Tail: 500');

	await lines.selectOption('50');
	await lines.selectOption('100');
	await expect(logOutput).toContainText('Tail: 100');
	await page.waitForTimeout(400);
	await expect(logOutput).not.toContainText('Tail: 50');

	await page.getByLabel('Show timestamps').check();
	await expect(logOutput).toContainText('2026-08-30T12:00:00Z Container started');
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
	await expect(page.getByRole('row', { name: /widube/ })).toContainText('Team');
	await expect(page.getByRole('row', { name: /widube/ })).toContainText('https://github.com');
});
