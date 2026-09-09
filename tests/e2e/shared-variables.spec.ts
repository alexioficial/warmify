import { expect, test } from '@playwright/test';
test.setTimeout(60000);
for (const [scope, path, original] of [
	['project', '/projects/project-1', 'project-shared-secret'],
	['environment', '/projects/project-1/environments/environment-1', 'environment-shared-secret']
]) {
	test(`${scope} shared variables support scoped CRUD, explicit replacement, reveal and secret boundaries`, async ({
		page
	}) => {
		await page.goto('/login');
		await page.getByLabel('Username').fill('admin');
		await page.getByLabel('Password').fill('password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		await page.goto(`${path}/settings`);
		await page
			.getByRole('navigation', { name: 'Hierarchy settings' })
			.getByRole('link', { name: 'Shared variables' })
			.click();
		await expect(page.getByRole('heading', { name: 'Shared variables' })).toBeVisible();
		expect(await page.content()).not.toContain(original);
		const html = await page.request.get(`${path}/shared-variables`);
		expect(await html.text()).not.toContain(original);
		const base = page.getByRole('row', { name: /BASE_KEY/ });
		await base.getByRole('button', { name: 'Reveal value' }).click();
		await expect(base.locator('.shared-value')).toHaveText(original);
		await base.getByRole('button', { name: 'Hide value' }).click();
		await expect(base.locator('.shared-value')).toHaveCount(0);
		await base
			.locator('summary')
			.filter({ hasText: /^Edit$/ })
			.click();
		await base.getByLabel('Key', { exact: true }).fill('RENAMED_KEY');
		await base.getByLabel('Comment', { exact: true }).fill('Updated metadata');
		await expect(base.getByLabel('Replacement value')).toBeDisabled();
		await base.getByRole('button', { name: 'Save variable' }).click();
		await expect(page.getByRole('status')).toContainText('updated');
		const renamed = page.getByRole('row', { name: /RENAMED_KEY/ });
		await renamed.getByRole('button', { name: 'Reveal value' }).click();
		await expect(renamed.locator('.shared-value')).toHaveText(original);
		await renamed
			.locator('summary')
			.filter({ hasText: /^Edit$/ })
			.click();
		await renamed.getByLabel('Stored value').selectOption('replace');
		await renamed.getByLabel('Replacement value').fill('replacement-shared-secret');
		await renamed.getByRole('button', { name: 'Save variable' }).click();
		await expect(page.getByRole('status')).toContainText('updated');
		expect(await page.content()).not.toContain('replacement-shared-secret');
		await renamed.getByRole('button', { name: 'Reveal value' }).click();
		await expect(renamed.locator('.shared-value')).toHaveText('replacement-shared-secret');
		await renamed
			.locator('summary')
			.filter({ hasText: /^Edit$/ })
			.click();
		await renamed.getByLabel('Stored value').selectOption('clear');
		await renamed.getByRole('button', { name: 'Save variable' }).click();
		await expect(page.getByRole('status')).toContainText('updated');
		await renamed.getByRole('button', { name: 'Reveal value' }).click();
		await expect(renamed.locator('.shared-value')).toHaveText('(null)');
		await page
			.locator('summary')
			.filter({ hasText: /^Add shared variable$/ })
			.click();
		const create = page.locator('form[action="?/createVariable"]');
		await create.getByLabel('Key', { exact: true }).fill('RENAMED_KEY');
		await create.getByLabel('Value', { exact: true }).fill('discarded-shared-secret');
		await create.getByRole('button', { name: 'Add variable' }).click();
		await expect(page.getByRole('alert')).toContainText('already exists');
		await expect(create.getByLabel('Key', { exact: true })).toHaveValue('RENAMED_KEY');
		await expect(create.getByLabel('Value', { exact: true })).toBeEmpty();
		expect(await page.content()).not.toContain('discarded-shared-secret');
		await create.getByLabel('Key', { exact: true }).fill('NEW_KEY');
		await expect(create.getByLabel('Key', { exact: true })).toHaveValue('NEW_KEY');
		await create.getByLabel('Value', { exact: true }).fill('once-shared-secret');
		await create.getByLabel('Shown once', { exact: true }).check();
		await create.getByRole('button', { name: 'Add variable' }).click();
		await expect(page.getByRole('status')).toContainText('created');
		const added = page.getByRole('row', { name: /NEW_KEY/ });
		await expect(added.getByRole('button', { name: 'Reveal value' })).toHaveCount(0);
		await expect(added).toContainText('unavailable');
		await added
			.locator('summary')
			.filter({ hasText: /^Delete$/ })
			.click();
		await added.locator('[name="confirmation"]').fill('wrong');
		await added.getByRole('button', { name: 'Delete variable' }).click();
		await expect(page.getByRole('alert')).toContainText('exactly');
		await added.locator('[name="confirmation"]').fill('NEW_KEY');
		await added.getByRole('button', { name: 'Delete variable' }).click();
		await expect(page.getByRole('status')).toContainText('deleted');
		await expect(added).toHaveCount(0);
		await renamed.getByRole('button', { name: 'Reveal value' }).click();
		await expect(renamed.locator('.shared-value')).toHaveText('(null)');
		await page
			.getByRole('navigation', { name: 'Hierarchy settings' })
			.getByRole('link', { name: 'Settings', exact: true })
			.click();
		await page.goBack();
		await expect(page.getByRole('heading', { name: 'Shared variables' })).toBeVisible();
		await expect(page.locator('.shared-value')).toHaveCount(0);
		const crossOrigin = await page.request.post(`${path}/shared-variables/reveal`, {
			headers: { origin: 'https://other.test' },
			data: { id: '100' }
		});
		expect(crossOrigin.status()).toBe(403);
	});
}
