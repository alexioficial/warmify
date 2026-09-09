import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
const root = '/projects/project-1/environments/environment-1/new';
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
for (const [kind, label, source, target] of [
	[
		'dockerfile',
		'Dockerfile content',
		'FROM alpine\n# creation-document-secret\nEXPOSE 3000\n',
		'/applications/app-2/general'
	],
	[
		'docker-compose',
		'Docker Compose file',
		'services:\n  web:\n    image: nginx\n# creation-document-secret\n',
		'/services/service-created/general'
	]
]) {
	test(`${kind} creation preserves safe drafts, clears documents and redirects`, async ({
		page
	}) => {
		await login(page);
		await page.goto(`${root}/${kind}`);
		await page.getByLabel('Server', { exact: true }).selectOption('server-1');
		await page.getByLabel('Name', { exact: true }).fill('Reject source');
		await page.getByLabel(label, { exact: true }).fill(source);
		await page.getByLabel('Deploy immediately').uncheck();
		await page.getByRole('button', { name: 'Create resource' }).click();
		await expect(page.getByRole('alert')).toContainText('Coolify rejected');
		await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Reject source');
		await expect(page.getByLabel('Server', { exact: true })).toHaveValue('server-1');
		await expect(page.getByLabel('Deploy immediately')).not.toBeChecked();
		await expect(page.getByLabel(label, { exact: true })).toBeEmpty();
		expect(await page.content()).not.toMatch(/creation-document-secret|response-creation-secret/);
		await page.getByLabel('Name', { exact: true }).fill('Created resource');
		await page.getByLabel(label, { exact: true }).fill(source);
		await page.getByRole('button', { name: 'Create resource' }).click();
		await expect(page).toHaveURL(target);
		expect(await page.content()).not.toMatch(/creation-document-secret|creation-response-secret/);
	});
}
test('Docker image creation supports separate digest and rejects conflicting tag', async ({
	page
}) => {
	await login(page);
	await page.goto(`${root}/docker-image`);
	await page.getByLabel('Server', { exact: true }).selectOption('server-1');
	await page.getByLabel('Image name', { exact: true }).fill('nginx');
	await expect(page.getByLabel('Tag', { exact: true })).toBeEmpty();
	await page.getByLabel('SHA256 digest').fill('a'.repeat(64));
	await page.getByLabel('Tag', { exact: true }).fill('stable');
	await page.getByLabel('Exposed ports').fill('8080');
	await page.getByRole('button', { name: 'Create resource' }).click();
	await expect(page.getByRole('alert')).toContainText('Correct the highlighted fields');
	await expect(page.getByLabel('SHA256 digest')).toHaveValue('a'.repeat(64));
	await page.getByLabel('Tag', { exact: true }).clear();
	await page.getByRole('button', { name: 'Create resource' }).click();
	await expect(page).toHaveURL('/applications/app-2/general');
	expect(await page.content()).not.toContain('creation-response-secret');
});
