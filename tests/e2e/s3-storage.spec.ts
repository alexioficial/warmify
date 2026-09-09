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
	const response = await request.get('http://127.0.0.1:4010/api/v1/s3-storages', { headers });
	if (!response.ok()) return;
	const storages = (await response.json()) as Array<{ uuid?: string }>;
	for (const storage of storages) {
		if (!storage.uuid?.startsWith('s3-created-')) continue;
		await request.delete(
			`http://127.0.0.1:4010/api/v1/s3-storages/${encodeURIComponent(storage.uuid)}`,
			{ headers }
		);
	}
});

test('creates, validates, rotates and deletes S3 storage without exposing credentials', async ({
	page
}) => {
	await login(page);
	await page.goto('/storage');
	await expect(page.getByRole('row', { name: /Primary backups/ })).toContainText('Usable');
	expect(await page.content()).not.toMatch(/s3-(?:access|secret)-list-fixture-secret/);

	await page.getByRole('link', { name: 'New S3 storage' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Created backups');
	await page.getByLabel('Endpoint').fill('https://s3.created.example.com');
	await page.getByLabel('Bucket').fill('created-backups');
	await page.getByLabel('Access key').fill('browser-access-secret');
	await page.getByLabel('Secret key').fill('browser-secret-key');
	await page.getByLabel('Description').fill('Created from the E2E flow');
	await page.getByRole('button', { name: 'Create storage' }).click();

	await expect(page).toHaveURL(/\/storage\/s3-created-\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'Created backups', exact: true })).toBeVisible();
	await expect(page.getByText('Needs validation', { exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/browser-(?:access-secret|secret-key)|s3-(?:create-response|detail)-fixture-secret/
	);

	await page.getByRole('button', { name: 'Validate connection' }).click();
	await expect(page.getByRole('status')).toHaveText('S3 storage connection is valid.');
	await expect(page.getByText('Usable', { exact: true })).toBeVisible();
	expect(await page.content()).not.toContain('s3-validation-response-fixture-secret');

	await page.getByLabel('Name', { exact: true }).fill('Rotated backups');
	await page.getByLabel('Replace secret key').fill('rotated-browser-secret');
	await page.getByRole('button', { name: 'Save storage' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'S3 storage settings saved. Validate the connection.'
	);
	await expect(page.getByRole('heading', { name: 'Rotated backups', exact: true })).toBeVisible();
	await expect(page.getByText('Needs validation', { exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/rotated-browser-secret|s3-update-response-fixture-secret/
	);

	await page.getByRole('link', { name: 'Danger zone' }).click();
	await page.getByLabel(/Type Rotated backups/).fill('Rotated backups');
	await page.getByRole('button', { name: 'Delete S3 storage permanently' }).click();
	await expect(page).toHaveURL('/storage');
	await expect(page.getByText('Rotated backups', { exact: true })).toHaveCount(0);
});
