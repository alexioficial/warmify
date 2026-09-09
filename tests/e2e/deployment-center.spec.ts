import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
test('deployment center submits UUID previews and reports missing targets without leaking backend messages', async ({
	page
}) => {
	await login(page);
	await page.goto('/deployments');
	await expect(page.getByText('Active application deployments.', { exact: false })).toBeVisible();
	await page.getByRole('link', { name: 'New deployment', exact: true }).click();
	await page.getByLabel('Targets (comma-separated)').fill('app-2, missing-app');
	await page.getByLabel('Force rebuild (without cache)').check();
	await page.getByLabel('Preview pull request ID').fill('12');
	await page.getByLabel('Docker preview tag').fill('preview-12');
	await page.getByLabel('I confirm these resources may be deployed or started.').check();
	await page.getByRole('button', { name: 'Deploy selected resources' }).click();
	const results = page.getByRole('region', { name: 'Deployment results' });
	await expect(results).toContainText('No result returned for this resource.');
	await expect(results).toContainText('missing-app');
	await expect(results.getByRole('link', { name: 'app-deploy-active' })).toHaveAttribute(
		'href',
		'/deployments/app-deploy-active'
	);
	expect(await page.content()).not.toContain('deployment-result-secret');
	await expect(
		page.getByLabel('I confirm these resources may be deployed or started.')
	).not.toBeChecked();
	await results.getByRole('link', { name: 'app-deploy-active' }).click();
	await expect(page.getByRole('heading', { name: 'Image App', exact: true })).toBeVisible();
});
test('deployment detail resolves hierarchy, follows live states and stops polling on completion', async ({
	page
}) => {
	await login(page);
	await page.clock.install();
	await page.goto('/deployments/detail-live');
	await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
	await expect(page.getByTestId('deployment-status')).toHaveText('Queued');
	const context = page.getByRole('navigation', { name: 'Deployment context' });
	await expect(context.getByRole('link', { name: 'Documentation', exact: true })).toHaveAttribute(
		'href',
		'/projects/project-1'
	);
	await expect(context.getByRole('link', { name: 'production', exact: true })).toHaveAttribute(
		'href',
		'/projects/project-1/environments/environment-1'
	);
	await expect(context.getByRole('link', { name: 'Image App', exact: true })).toHaveAttribute(
		'href',
		'/applications/app-2/general'
	);
	let polls = 0;
	page.on('request', (request) => {
		if (request.url().includes('/internal/poll/deployments/detail-live')) polls++;
	});
	await page.clock.fastForward(5100);
	await expect(page.getByTestId('deployment-status')).toHaveText('In progress');
	await page.clock.fastForward(5100);
	await expect(page.getByTestId('deployment-status')).toHaveText('Success');
	await expect(page.locator('.log-output')).toContainText('Status: finished');
	await expect(page.getByRole('button', { name: 'Cancel deployment', exact: true })).toHaveCount(0);
	const completedPolls = polls;
	await page.clock.fastForward(15000);
	expect(polls).toBe(completedPolls);
	expect(await page.content()).not.toMatch(/deployment-(?:snapshot|command|hidden)-secret/);
});
test('deployment failure and cancellation have terminal status and history stays scoped', async ({
	page
}) => {
	await login(page);
	await page.goto('/deployments/detail-failed');
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(page.getByTestId('deployment-status')).toHaveText('Failed');
	await page.goto('/deployments/detail-cancel');
	await expect(page.getByTestId('deployment-status')).toHaveText('In progress');
	const unconfirmed = await page.request.post('/deployments/detail-cancel?/cancel', {
		form: {},
		headers: { accept: 'application/json', origin: new URL(page.url()).origin }
	});
	expect(await unconfirmed.json()).toMatchObject({ type: 'failure', status: 400 });
	await page.getByLabel('I confirm cancellation of this deployment.').check();
	await page.getByRole('button', { name: 'Cancel deployment', exact: true }).click();
	await expect(page.getByTestId('deployment-status')).toHaveText('Cancelled');
	await expect(page.locator('.log-output')).toContainText('Status: cancelled-by-user');
	await page.goBack();
	await expect(page).toHaveURL('/deployments/detail-failed');
	await expect(page.getByTestId('deployment-status')).toHaveText('Failed');
	await page.goForward();
	await expect(page).toHaveURL('/deployments/detail-cancel');
	await expect(page.getByTestId('deployment-status')).toHaveText('Cancelled');
});
test('hidden deployment details stop requests and refresh when visible again', async ({ page }) => {
	await login(page);
	await page.clock.install();
	await page.goto('/deployments/detail-hidden');
	await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
	await expect(page.getByTestId('deployment-status')).toHaveText('In progress');
	let polls = 0;
	page.on('request', (request) => {
		if (request.url().includes('/internal/poll/deployments/detail-hidden')) polls++;
	});
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.clock.fastForward(15000);
	expect(polls).toBe(0);
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect.poll(() => polls).toBe(1);
	await page.goto('/projects');
	await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
	const stoppedPolls = polls;
	await page.clock.fastForward(15000);
	expect(polls).toBe(stoppedPolls);
});
test('uncertain deployment failures preserve safe values and tags omit preview inputs', async ({
	page
}) => {
	await login(page);
	await page.goto('/deployments/new');
	await page.getByLabel('Targets (comma-separated)').fill('limited');
	await page.getByLabel('I confirm these resources may be deployed or started.').check();
	await page.getByRole('button', { name: 'Deploy selected resources' }).click();
	await expect(
		page.getByText('Some resources may already have started.', { exact: false })
	).toBeVisible();
	await expect(page.getByText('Coolify requested a retry delay of 60 seconds.')).toBeVisible();
	await expect(page.getByLabel('Targets (comma-separated)')).toHaveValue('limited');
	expect(await page.content()).not.toContain('deployment-backend-secret');
	await page.getByLabel('Preview pull request ID').fill('12');
	await page.getByLabel('Docker preview tag').fill('preview-12');
	await page.getByLabel('Selection', { exact: true }).selectOption('tag');
	await expect(page.getByLabel('Preview pull request ID')).toHaveCount(0);
	await page.getByLabel('Targets (comma-separated)').fill('production, web');
	await page.getByLabel('I confirm these resources may be deployed or started.').check();
	await page.getByRole('button', { name: 'Deploy selected resources' }).click();
	await expect(page.getByRole('region', { name: 'Deployment results' })).toContainText(
		'Tags select applications and services, not databases.'
	);
	await expect(
		page
			.getByRole('region', { name: 'Deployment results' })
			.getByRole('link', { name: 'app-deploy-active' })
	).toBeVisible();
	expect(await page.content()).not.toContain('deployment-result-secret');
});
