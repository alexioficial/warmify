import { expect, test, type Page } from '@playwright/test';

const headers = { Authorization: 'Bearer 1|e2e-secret' };

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test.afterEach(async ({ request }) => {
	for (const provider of ['github', 'gitlab']) {
		const response = await request.get(`http://127.0.0.1:4010/api/v1/${provider}-apps`, {
			headers
		});
		if (!response.ok()) continue;
		const sources = (await response.json()) as Array<{ id?: number }>;
		for (const source of sources) {
			if (!source.id || source.id < 20) continue;
			await request.delete(`http://127.0.0.1:4010/api/v1/${provider}-apps/${source.id}`, {
				headers
			});
		}
	}
});

test('lists both providers and discovers GitHub repositories without exposing secrets', async ({
	page
}) => {
	await login(page);
	await page.goto('/sources');
	await expect(page.getByRole('row', { name: /widube GitHub App/ })).toBeVisible();
	await expect(page.getByRole('row', { name: /Internal GitLab GitLab App/ })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/(?:github|gitlab)-(?:list|webhook|access)-fixture-secret/
	);

	await page.getByRole('link', { name: 'widube', exact: true }).click();
	await expect(page).toHaveURL('/sources/github/7/general');
	await expect(page.getByRole('heading', { name: 'widube', exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(/github-(?:list|webhook)-fixture-secret/);

	await page.getByRole('link', { name: 'Repositories', exact: true }).click();
	await expect(page.getByRole('row', { name: /widube\/api/ })).toBeVisible();
	await page.getByLabel('Repository').selectOption('widube/api');
	await page.getByRole('button', { name: 'Load branches' }).click();
	await expect(page.getByRole('heading', { name: 'Branches in widube/api' })).toBeVisible();
	await expect(page.getByText('develop', { exact: true })).toBeVisible();
	await expect(page.getByText('main', { exact: true })).toBeVisible();
});

test('creates, rotates and deletes a GitLab App through exact public API operations', async ({
	page
}) => {
	await login(page);
	await page.goto('/sources/new/gitlab');
	await page.getByLabel('Name', { exact: true }).fill('Created GitLab');
	await page.getByLabel('Provider URL').fill('https://gitlab.created.example.com');
	await page.getByLabel('API URL').fill('https://gitlab.created.example.com/api/v4');
	await page.getByLabel('Group name').fill('platform');
	await page.getByLabel('OAuth application ID').fill('created-client');
	await page.getByLabel('OAuth client secret').fill('browser-replacement-secret');
	await page.getByLabel('Webhook token').fill('browser-webhook-secret');
	await page
		.getByLabel('OAuth redirect URI')
		.fill('https://coolify.example.com/webhooks/source/gitlab/redirect');
	await page.getByRole('button', { name: 'Create source' }).click();

	await expect(page).toHaveURL(/\/sources\/gitlab\/\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'Created GitLab', exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/browser-(?:replacement|webhook)-secret|source-create-response-fixture-secret/
	);

	await page.getByLabel('Name', { exact: true }).fill('Rotated GitLab');
	await page.getByLabel('Replace OAuth client secret').fill('rotated-browser-secret');
	await page.getByRole('button', { name: 'Save source' }).click();
	await expect(page.getByRole('status')).toHaveText('GitLab App settings saved.');
	await expect(page.getByRole('heading', { name: 'Rotated GitLab', exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/rotated-browser-secret|source-update-response-fixture-secret/
	);

	await page.getByRole('link', { name: 'Danger zone' }).click();
	await page.getByLabel(/Type Rotated GitLab/).fill('Rotated GitLab');
	await page.getByRole('button', { name: 'Delete source permanently' }).click();
	await expect(page).toHaveURL('/sources');
	await expect(page.getByText('Rotated GitLab', { exact: true })).toHaveCount(0);
});
