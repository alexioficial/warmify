import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('survives rapid hierarchy navigation and repeated browser history traversal', async ({
	page
}) => {
	await login(page);

	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await page.getByRole('link', { name: 'Documentation' }).click();
	await page.getByRole('link', { name: 'production' }).click();
	await page.getByRole('row', { name: /Website/ }).click();
	await expect(page).toHaveURL('/applications/app-1/general');

	await page.goBack();
	await expect(page).toHaveURL('/projects/project-1/environments/environment-1');
	await expect(page.getByRole('heading', { name: 'production' })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL('/projects/project-1');
	await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL('/projects');
	await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Loading page' })).toHaveCount(0);

	await page.goForward();
	await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();
});

test('keeps cached inventory visible on refresh failure and retries when the tab becomes visible', async ({
	page
}) => {
	await login(page);
	await page.goto('/projects');
	await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
	await expect(page.getByText(/Last synchronized/)).toBeVisible();

	await page.route('**/internal/poll/collections/projects', (route) =>
		route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
	);
	await page.reload();
	await expect(page.getByRole('link', { name: 'Documentation' })).toBeVisible();
	await expect(page.getByText(/Cached data is shown; live synchronization failed/)).toBeVisible();

	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await page.unroute('**/internal/poll/collections/projects');
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.getByText(/Cached data is shown; live synchronization failed/)).toHaveCount(0);
	await expect(page.getByText(/Last synchronized/)).toBeVisible();
});

test('refreshes global search without a persistent index and exposes keyboard focus and overflow', async ({
	page
}) => {
	await login(page);
	await page.getByLabel('Search', { exact: true }).fill('Documentation');
	await page.getByLabel('Search', { exact: true }).press('Enter');
	await expect(page).toHaveURL('/search?q=Documentation');
	await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
		'href',
		'/projects/project-1'
	);
	expect(await page.content()).not.toContain('fixture-secret');
	await expect(page.getByText(/Last synchronized/)).toBeVisible();

	await page.goto('/servers');
	await page.setViewportSize({ width: 480, height: 720 });
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('#main-content')).toBeFocused();
	const overflow = await page.locator('.table-wrap').evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth
	}));
	expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
});
