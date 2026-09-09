import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
async function section(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Database settings' })
		.getByRole('link', { name, exact: true })
		.click();
}
test('database variables update, bulk validation and confirmed deletion', async ({ page }) => {
	await login(page);
	await page.goto('/databases/db-vars/environment-variables');
	const row = page.getByRole('row', { name: /DB_MODE/ });
	await row
		.locator('summary')
		.filter({ hasText: /^Edit$/ })
		.click();
	const update = row.locator('form[action="?/updateVariable"]');
	await update.getByLabel('Replacement value').fill('updated-variable-secret');
	await update.getByLabel('Comment', { exact: true }).fill('Updated metadata');
	await update.getByLabel('Literal', { exact: true }).check();
	await update.getByRole('button', { name: 'Save variable' }).click();
	await expect(page.getByRole('status')).toContainText('DB_MODE updated');
	await expect(row).toContainText('Updated metadata');
	expect(await page.content()).not.toContain('updated-variable-secret');
	await row
		.locator('summary')
		.filter({ hasText: /^Edit$/ })
		.click();
	await expect(update.getByLabel('Literal', { exact: true })).toBeChecked();
	await expect(update.getByLabel('Replacement value')).toBeEmpty();
	await page
		.locator('summary')
		.filter({ hasText: /^Bulk upsert$/ })
		.click();
	const bulk = page.locator('form[action="?/bulkVariables"]');
	await bulk.getByLabel('Production', { exact: true }).fill('INVALID-LINE');
	await bulk.getByRole('button', { name: 'Upsert variables' }).click();
	await page
		.locator('summary')
		.filter({ hasText: /^Bulk upsert$/ })
		.click();
	await expect(page.getByText('Line 1 must use KEY=value.')).toBeVisible();
	await expect(bulk.getByLabel('Production', { exact: true })).toBeEmpty();
	await bulk
		.getByLabel('Production', { exact: true })
		.fill('DB_MODE=bulk-secret\nNEW_KEY=new-secret');
	await bulk.getByRole('button', { name: 'Upsert variables' }).click();
	await expect(page.getByRole('status')).toContainText('2 variables upserted');
	await expect(page.getByRole('row', { name: /NEW_KEY/ })).toBeVisible();
	expect(await page.content()).not.toMatch(/bulk-secret|new-secret/);
	const newRow = page.getByRole('row', { name: /NEW_KEY/ });
	await newRow
		.locator('summary')
		.filter({ hasText: /^Delete$/ })
		.click();
	await newRow.locator('[name="confirmation"]').fill('wrong');
	await newRow.getByRole('button', { name: 'Delete variable' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await newRow
		.locator('summary')
		.filter({ hasText: /^Delete$/ })
		.click();
	await newRow.locator('[name="confirmation"]').fill('NEW_KEY');
	await newRow.getByRole('button', { name: 'Delete variable' }).click();
	await expect(page.getByRole('row', { name: /NEW_KEY/ })).toHaveCount(0);
});

async function switchDatabase(page: Page, path: string) {
	// Fixture-only anchor exercises SvelteKit's real delegated link navigation, not a document reload.
	await page.evaluate((href) => {
		document.querySelector('#database-navigation-probe')?.remove();
		const link = document.createElement('a');
		link.id = 'database-navigation-probe';
		link.href = href;
		link.textContent = 'Switch database';
		const main = document.querySelector('main');
		if (!main) throw new Error('Database page must have a main landmark.');
		main.prepend(link);
	}, path);
	await page.locator('#database-navigation-probe').click();
	await expect(page).toHaveURL(path);
}
test('same-section database navigation clears drafts and revealed secrets across UUIDs and history', async ({
	page
}) => {
	await login(page);
	await page.goto('/databases/db-nav-a/general');
	await expect(page.getByRole('button', { name: 'Save general' })).toBeEnabled();
	await page.evaluate(() => {
		document.documentElement.dataset.navigationProbe = 'same-document';
	});
	await page.getByLabel('Name', { exact: true }).fill('Unsaved A');
	await switchDatabase(page, '/databases/db-nav-b/general');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Navigation B');
	await expect(page.locator('html')).toHaveAttribute('data-navigation-probe', 'same-document');
	await page.goBack();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Navigation A');
	await page.goForward();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Navigation B');
	await section(page, 'Credentials');
	await page.getByRole('button', { name: 'Reveal connection details' }).click();
	await expect(page.locator('dd code').first()).toContainText('postgres-fixture-secret');
	await page.getByLabel('Postgres password', { exact: true }).fill('unsaved-password');
	await switchDatabase(page, '/databases/db-nav-a/credentials');
	await expect(page.getByLabel('Postgres password', { exact: true })).toBeEmpty();
	await expect(page.getByRole('button', { name: 'Reveal connection details' })).toBeVisible();
	await expect(page.locator('dd code')).toHaveCount(0);
	await section(page, 'Environment variables');
	await page
		.locator('summary')
		.filter({ hasText: /^Add variable$/ })
		.click();
	await page.locator('form[action="?/createVariable"] [name="key"]').fill('UNSAVED_KEY');
	await page
		.locator('form[action="?/createVariable"] [name="value"]')
		.fill('unsaved-variable-secret');
	await switchDatabase(page, '/databases/db-nav-b/environment-variables');
	await page
		.locator('summary')
		.filter({ hasText: /^Add variable$/ })
		.click();
	await expect(page.locator('form[action="?/createVariable"] [name="key"]')).toBeEmpty();
	await expect(page.locator('form[action="?/createVariable"] [name="value"]')).toBeEmpty();
});

test('database creation validates public access and preserves safe fields without passwords', async ({
	page
}) => {
	await login(page);
	await page.goto('/projects/project-1/environments/environment-1/new/postgresql');
	await page.getByRole('combobox', { name: 'Server', exact: true }).selectOption('server-1');
	await page.getByLabel('Name', { exact: true }).fill('Reject creation');
	await page.getByLabel('Postgres password', { exact: true }).fill('creation-input-secret');
	await page
		.getByLabel('Configuration document', { exact: true })
		.fill('password=creation-config-secret');
	await page.getByLabel('Deploy immediately', { exact: true }).uncheck();
	await page.getByLabel('Expose database publicly', { exact: true }).check();
	await page.getByRole('button', { name: 'Create database', exact: true }).click();
	await expect(page.getByText('A public port is required to expose this database.')).toBeVisible();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Reject creation');
	await expect(page.getByLabel('Postgres password', { exact: true })).toBeEmpty();
	await expect(page.getByLabel('Configuration document', { exact: true })).toBeEmpty();
	await expect(page.getByLabel('Deploy immediately', { exact: true })).not.toBeChecked();
	await expect(page.getByLabel('Expose database publicly', { exact: true })).toBeChecked();
	await page.getByLabel('Public port', { exact: true }).fill('15432');
	await page.getByRole('button', { name: 'Create database', exact: true }).click();
	await expect(page.getByText('Choose another name.')).toBeVisible();
	await page.getByLabel('Name', { exact: true }).fill('Created SQL');
	await page.getByLabel('Postgres password', { exact: true }).fill('creation-input-secret');
	await page.getByLabel('Tags (comma-separated)', { exact: true }).fill('production, data');
	await page.getByRole('button', { name: 'Create database', exact: true }).click();
	await expect(page).toHaveURL(/\/databases\/db-created-postgresql-\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'Created SQL', exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(/creation-input-secret|creation-response-secret/);
	await page.goto('/projects/project-1/environments/environment-1/new/redis');
	await page.getByRole('combobox', { name: 'Server', exact: true }).selectOption('server-1');
	await expect(page.getByLabel('Postgres password', { exact: true })).toHaveCount(0);
	await page.getByLabel('Redis password', { exact: true }).fill('redis-creation-secret');
	await page.getByLabel('Name', { exact: true }).fill('Created Redis');
	await page.getByLabel('Deploy immediately', { exact: true }).uncheck();
	await page.getByRole('button', { name: 'Create database', exact: true }).click();
	await expect(page).toHaveURL(/\/databases\/db-created-redis-\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'Created Redis', exact: true })).toBeVisible();
});

test('database tags, confirmed clone/move/migrate and safe deletion flags', async ({ page }) => {
	await login(page);
	await page.goto('/databases/db-ops/tags');
	await page.getByLabel('Tag names').fill('x');
	await page.getByRole('button', { name: 'Add tags' }).click();
	await expect(page.getByRole('alert')).toContainText('at least two');
	await expect(page.getByLabel('Tag names')).toHaveValue('x');
	await page.getByLabel('Tag names').fill('production');
	await page.getByRole('button', { name: 'Add tags' }).click();
	await page
		.locator('summary')
		.filter({ hasText: /^production$/ })
		.click();
	await page.locator('form[action="?/deleteTag"] input[name="confirmation"]').fill('production');
	await page.getByRole('button', { name: 'Remove tag' }).click();
	await expect(page.getByText('No tags attached.')).toBeVisible();
	await section(page, 'Resource operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Clone database$/ })
		.click();
	const clone = page.locator('form[action="?/cloneDatabase"]');
	await clone
		.getByRole('combobox', { name: 'Destination', exact: true })
		.selectOption('destination-1');
	await clone.getByLabel('New name (optional)').fill('SQL copy');
	await clone.locator('[name="confirmation"]').fill('clone SQL database');
	await clone.getByRole('button', { name: 'Clone database', exact: true }).click();
	await expect(page).toHaveURL(/\/databases\/db-copy-\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'SQL copy', exact: true })).toBeVisible();
	await page.goto('/databases/db-ops/resource-operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Move to environment$/ })
		.click();
	const move = page.locator('form[action="?/moveDatabase"]');
	await move
		.getByRole('combobox', { name: 'Environment', exact: true })
		.selectOption('environment-1');
	await move.locator('[name="confirmation"]').fill('move SQL database');
	await move.getByRole('button', { name: 'Move database', exact: true }).click();
	await expect(page).toHaveURL(/\/db-ops\/general$/);
	await expect(
		page.getByLabel('Breadcrumb').getByRole('link', { name: 'Documentation', exact: true })
	).toBeVisible();
	await section(page, 'Resource operations');
	await page
		.locator('summary')
		.filter({ hasText: /^Migrate to server$/ })
		.click();
	const migrate = page.locator('form[action="?/migrateDatabase"]');
	await migrate
		.getByRole('combobox', { name: 'Destination', exact: true })
		.selectOption('destination-1');
	await migrate.getByLabel('Transfer persistent volume data').uncheck();
	await migrate.locator('[name="confirmation"]').fill('migrate SQL database');
	await migrate.getByRole('button', { name: 'Migrate database', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('migration requested');
	await section(page, 'Servers');
	await expect(page.getByText('Target server', { exact: true })).toBeVisible();
	await section(page, 'Danger zone');
	await expect(page.getByLabel('Delete persistent volumes', { exact: true })).not.toBeChecked();
	await page.getByRole('textbox', { name: /Type SQL database or db-ops/ }).fill('wrong');
	await page.getByRole('button', { name: 'Delete database permanently' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await page.getByRole('textbox', { name: /Type SQL database or db-ops/ }).fill('db-ops');
	await page.getByRole('button', { name: 'Delete database permanently' }).click();
	await expect(page).toHaveURL(/\/projects$/);
	await page.goto('/databases/db-ops/general');
	await expect(page.getByRole('alert')).toContainText('unavailable');
});

test('native database backup schedules, S3 retention, confirmed runs and archive deletion', async ({
	page
}) => {
	await login(page);
	await page.goto('/databases/db-backups/backups');
	await page
		.locator('summary')
		.filter({ hasText: /^Add backup schedule$/ })
		.click();
	await page.getByLabel('Frequency', { exact: true }).fill('invalid');
	await page.getByRole('button', { name: 'Create backup schedule' }).click();
	await expect(page.getByRole('alert')).toContainText('Invalid frequency');
	await page
		.locator('summary')
		.filter({ hasText: /^Add backup schedule$/ })
		.click();
	await expect(page.getByLabel('Frequency', { exact: true })).toHaveValue('invalid');
	await page.getByLabel('Frequency', { exact: true }).fill('daily');
	await page.getByRole('button', { name: 'Create backup schedule' }).click();
	await expect(page).toHaveURL(/\/backups\/native-backup-\d+$/);
	const uuid = page.url().split('/').at(-1)!;
	await expect(
		page
			.getByRole('navigation', { name: 'Database settings' })
			.getByRole('link', { name: 'Backups', exact: true })
	).toHaveAttribute('aria-current', 'page');
	await page.getByLabel('Copy backups to S3').check();
	await page.getByRole('combobox', { name: 'S3 destination', exact: true }).selectOption('s3-1');
	await page.getByLabel('Local maximum storage (GB)', { exact: true }).fill('1.5');
	await page.getByRole('button', { name: 'Save backup schedule' }).click();
	await expect(page.getByRole('status')).toContainText('Backup schedule saved');
	await expect(page.getByRole('combobox', { name: 'S3 destination', exact: true })).toHaveValue(
		's3-1'
	);
	await expect(page.getByLabel('Local maximum storage (GB)', { exact: true })).toHaveValue('1.5');
	const run = page.locator('form[action="?/run"]');
	await run.locator('input[name="confirmation"]').fill('wrong');
	await run.getByRole('button').click();
	await expect(page.getByRole('alert')).toContainText('exactly');
	await expect(page.getByText('No backup executions.')).toBeVisible();
	await run.locator('input[name="confirmation"]').fill(`run ${uuid}`);
	await run.getByRole('button').click();
	await expect(page.getByRole('status')).toContainText('Database backup queued');
	const row = page.getByRole('row', { name: /database.dump/ });
	await expect(row).toContainText('success');
	expect(await page.content()).not.toContain('postgres-fixture-secret');
	expect(await page.content()).not.toContain('backup-output-secret');
	await row
		.locator('summary')
		.filter({ hasText: /^Delete execution$/ })
		.click();
	const deletion = row.locator('form[action="?/deleteExecution"]');
	const execution = await deletion.locator('[name="execution_uuid"]').inputValue();
	await deletion.locator('[name="confirmation"]').fill(execution);
	await deletion.getByRole('button').click();
	await expect(page.getByRole('status')).toContainText('Backup execution deleted');
	await expect(page.getByText('No backup executions.')).toBeVisible();
	const remove = page.locator('form[action="?/deleteSchedule"]');
	await remove.locator('[name="confirmation"]').fill(uuid);
	await remove.getByRole('button').click();
	await expect(page.getByText('No native backup schedules.')).toBeVisible();
	await page.goto('/databases/db-redis/backups');
	await expect(page.getByRole('button', { name: 'Create backup schedule' })).toHaveCount(0);
	await expect(page.getByRole('alert')).toContainText('unavailable');
});
test('SQL database configuration, reveal boundaries, healthcheck and navigation history', async ({
	page
}) => {
	await login(page);
	await page.goto('/databases/db-postgres');
	await expect(page).toHaveURL(/\/db-postgres\/general$/);
	await page.getByLabel('Description', { exact: true }).fill('Updated SQL database');
	await page.getByRole('button', { name: 'Save general' }).click();
	await expect(page.getByRole('status')).toContainText('Configuration saved');
	await section(page, 'Credentials');
	const html = await page.content();
	for (const secret of [
		'postgres-fixture-secret',
		'postgres-config-secret',
		'init-fixture-secret',
		'database-host-secret'
	])
		expect(html).not.toContain(secret);
	await expect(page.getByLabel('Postgres password', { exact: true })).toHaveValue('');
	const rejected = await page.request.post('/internal/databases/db-postgres/credentials', {
		headers: { origin: 'https://untrusted.example' }
	});
	expect(rejected.status()).toBe(403);
	const responsePromise = page.waitForResponse(
		(response) =>
			response.url().endsWith('/internal/databases/db-postgres/credentials') &&
			response.status() === 200
	);
	await page.getByRole('button', { name: 'Reveal connection details' }).click();
	const response = await responsePromise;
	expect(response.headers()['cache-control']).toContain('no-store');
	expect(await response.text()).not.toContain('database-host-secret');
	await expect(page.locator('dd code').first()).toContainText('postgres-fixture-secret');
	await page.getByRole('button', { name: 'Hide connection details' }).click();
	await expect(page.locator('dd code')).toHaveCount(0);
	await section(page, 'Configuration');
	await page.getByLabel('Configuration document').fill('max_connections = 150');
	await page.getByRole('button', { name: 'Save configuration' }).click();
	await expect(page.getByRole('status')).toContainText('Configuration saved');
	await expect(page.getByLabel('Configuration document')).toHaveValue('');
	await section(page, 'Healthcheck');
	await page.getByLabel('Interval', { exact: true }).fill('45');
	await page.getByRole('button', { name: 'Save healthcheck' }).click();
	await expect(page.getByRole('status')).toContainText('Configuration saved');
	await section(page, 'Networking');
	await page.getByLabel('Public port', { exact: true }).fill('15432');
	await page.getByRole('button', { name: 'Save networking' }).click();
	await expect(page.getByRole('status')).toContainText('Configuration saved');
	// Start a link-only history sequence; native form POSTs have their own entries.
	await section(page, 'Healthcheck');
	await expect(page.getByLabel('Interval', { exact: true })).toHaveValue('45');
	await section(page, 'Networking');
	await section(page, 'Runtime logs');
	await expect(page.locator('.log-output')).toContainText('SQL database: ready');
	await page.goBack();
	await expect(page.getByLabel('Public port', { exact: true })).toHaveValue('15432');
	await page.goBack();
	await expect(page.getByLabel('Interval', { exact: true })).toHaveValue('45');
	await page.goForward();
	await expect(page.getByLabel('Public port', { exact: true })).toHaveValue('15432');
});
test('Redis variables, storage and volume backup use database-specific payloads', async ({
	page
}) => {
	await login(page);
	await page.goto('/databases/db-redis/environment-variables');
	expect(await page.content()).not.toContain('database-env-secret');
	await expect(page.getByRole('columnheader', { name: 'Buildtime' })).toHaveCount(0);
	await page
		.locator('summary')
		.filter({ hasText: /^Add variable$/ })
		.click();
	const create = page.locator('form[action="?/createVariable"]');
	await create.getByLabel('Key', { exact: true }).fill('CACHE_MODE');
	await create.getByLabel('Value', { exact: true }).fill('redis-value-secret');
	await create.getByRole('button', { name: 'Add variable' }).click();
	await expect(page.getByRole('row', { name: /CACHE_MODE/ })).toBeVisible();
	expect(await page.content()).not.toContain('redis-value-secret');
	await section(page, 'Persistent storage');
	await page
		.locator('summary')
		.filter({ hasText: /^Add storage$/ })
		.click();
	const storage = page.locator('form[action="?/createStorage"]');
	await storage.locator('[name="name"]').fill('redis-extra');
	await storage.locator('[name="mount_path"]').fill('/extra');
	await storage.getByRole('button', { name: 'Add storage' }).click();
	await expect(page.getByRole('row', { name: /redis-extra/ })).toBeVisible();
	const row = page.getByRole('row', { name: /database-data/ }).first();
	await row
		.locator('summary')
		.filter({ hasText: /^Backup schedule$/ })
		.click();
	await row.getByRole('button', { name: 'Save backup schedule' }).click();
	await expect(page.getByRole('status')).toContainText('Backup schedule saved');
	await row
		.locator('summary')
		.filter({ hasText: /^Back up now$/ })
		.click();
	await row.locator('form[action="?/runBackup"] input[name="confirmation"]').fill('run backup');
	await row.getByRole('button', { name: 'Queue backup' }).click();
	await expect(page.getByRole('status')).toContainText('Storage backup queued');
	await section(page, 'Credentials');
	await expect(page.getByLabel('Redis password', { exact: true })).toHaveValue('');
	await expect(page.getByLabel('Postgres password', { exact: true })).toHaveCount(0);
});
