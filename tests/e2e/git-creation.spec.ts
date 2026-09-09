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
test('public Git creation switches build fields, preserves safe drafts and clears commands', async ({
	page
}) => {
	await login(page);
	await page.goto(`${root}/public-repository`);
	await page.getByLabel('Server', { exact: true }).selectOption('server-1');
	await page.getByLabel('Repository URL').fill('https://github.com/widube/website');
	await page.getByLabel('Build pack').selectOption('dockercompose');
	await expect(page.getByLabel('Compose file', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Domains', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Exposed ports')).toHaveCount(0);
	await page.getByLabel('Build pack').selectOption('dockerfile');
	await expect(page.getByLabel('Dockerfile path')).toBeVisible();
	await expect(page.getByLabel('Build command', { exact: true })).toHaveCount(0);
	await page.getByLabel('Build pack').selectOption('static');
	await expect(page.getByLabel('Publish directory')).toBeVisible();
	await expect(page.getByLabel('Exposed ports')).toHaveCount(0);
	await page.getByLabel('Build pack').selectOption('railpack');
	await page.getByLabel('Build command', { exact: true }).fill('echo git-command-secret');
	await page.getByLabel('Name', { exact: true }).fill('Reject Git');
	await page.getByLabel('Deploy immediately').uncheck();
	await page.getByRole('button', { name: 'Create application' }).click();
	await expect(page.getByRole('alert')).toContainText('Coolify rejected');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Reject Git');
	await expect(page.getByLabel('Repository URL')).toHaveValue('https://github.com/widube/website');
	await expect(page.getByLabel('Deploy immediately')).not.toBeChecked();
	await expect(page.getByLabel('Build command', { exact: true })).toBeEmpty();
	expect(await page.content()).not.toMatch(/git-command-secret|git-response-secret/);
	await page.getByLabel('Name', { exact: true }).fill('Created public');
	await page.getByRole('button', { name: 'Create application' }).click();
	await expect(page).toHaveURL('/applications/app-1/general');
});
test('deploy key creates a Git Compose application without ordinary domains or ports', async ({
	page
}) => {
	await login(page);
	await page.goto(`${root}/private-deploy-key`);
	await page.getByLabel('Server', { exact: true }).selectOption('server-1');
	await page.getByLabel('Private key', { exact: true }).selectOption('key-1');
	await page.getByLabel('Repository URL').fill('git@github.com:widube/website.git');
	await page.getByLabel('Build pack').selectOption('dockercompose');
	await page.getByLabel('Compose file', { exact: true }).fill('/compose.yaml');
	expect(await page.content()).not.toContain('git-key-secret');
	await page.getByRole('button', { name: 'Create application' }).click();
	await expect(page).toHaveURL('/applications/app-1/general');
});
test('GitHub App discovery uses ID then creates using UUID and selected repository', async ({
	page
}) => {
	await login(page);
	await page.goto(`${root}/github-app`);
	await page.getByLabel('Discover with GitHub App').selectOption('7');
	await page.getByRole('button', { name: 'Load repositories' }).click();
	await page.getByLabel('Discover branches for repository').selectOption('widube/api');
	await page.getByRole('button', { name: 'Load branches' }).click();
	const create = page.getByRole('form', { name: 'Create Git application' });
	await expect(create.getByLabel('GitHub App', { exact: true })).toHaveValue('github-app-1');
	await expect(create.getByLabel('Repository', { exact: true })).toHaveValue('widube/api');
	await expect(page.locator('#git-branches option[value="develop"]')).toHaveCount(1);
	await create.getByLabel('Branch', { exact: true }).fill('develop');
	await create.getByLabel('Server', { exact: true }).selectOption('server-1');
	await create.getByRole('button', { name: 'Create application' }).click();
	await expect(page).toHaveURL('/applications/app-1/general');
	expect(await page.content()).not.toContain('git-response-secret');
});
