import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test.afterEach(async ({ request }) => {
	await request.patch('http://127.0.0.1:4010/api/v1/servers/server-1', {
		headers: { Authorization: 'Bearer 1|e2e-secret' },
		data: {
			name: 'Primary server',
			description: 'Main deployment host',
			ip: '10.0.0.1',
			port: 22,
			user: 'root',
			concurrent_builds: 2,
			dynamic_timeout: 3600,
			deployment_queue_limit: 25,
			server_disk_usage_notification_threshold: 80,
			server_disk_usage_check_frequency: '0 23 * * *',
			connection_timeout: 10,
			is_build_server: false,
			is_terminal_enabled: false
		}
	});
	await request.delete('http://127.0.0.1:4010/api/v1/servers/server-created', {
		headers: { Authorization: 'Bearer 1|e2e-secret' }
	});
	const destinationResponse = await request.get('http://127.0.0.1:4010/api/v1/destinations', {
		headers: { Authorization: 'Bearer 1|e2e-secret' }
	});
	if (destinationResponse.ok()) {
		const destinations = (await destinationResponse.json()) as Array<{ uuid?: string }>;
		for (const destination of destinations) {
			if (!destination.uuid?.startsWith('destination-created-')) continue;
			await request.delete(
				`http://127.0.0.1:4010/api/v1/destinations/${encodeURIComponent(destination.uuid)}`,
				{ headers: { Authorization: 'Bearer 1|e2e-secret' } }
			);
		}
	}
});

test('creates a server from a projected private-key choice', async ({ page }) => {
	await login(page);
	await page.goto('/servers');
	await page.getByRole('link', { name: 'New server' }).click();
	await expect(page).toHaveURL('/servers/new');
	expect(await page.content()).not.toContain('private-key-fixture-secret');

	await page.getByLabel('Name', { exact: true }).fill('Created edge');
	await page.getByLabel('IP address or hostname').fill('edge.example.com');
	await page.getByLabel('Private key').selectOption('key-1');
	await page.getByLabel('Queue validation after creation').check();
	await page.getByRole('button', { name: 'Create server' }).click();

	await expect(page).toHaveURL('/servers/server-created/general');
	await expect(page.getByRole('heading', { name: 'Created edge', exact: true })).toBeVisible();
	expect(await page.content()).not.toContain('created-server-fixture-secret');
});

test('creates, edits and deletes a server-owned destination', async ({ page }) => {
	await login(page);
	await page.goto('/servers/server-1/destinations');
	await expect(page.getByRole('row', { name: /Primary destination/ })).toContainText('coolify');
	expect(await page.content()).not.toContain('destination-detail-fixture-secret');

	await page.getByText('New destination', { exact: true }).click();
	await page.getByLabel('Name', { exact: true }).fill('Edge destination');
	await page.getByLabel('Docker network').fill('edge-network');
	await page.getByRole('button', { name: 'Create destination' }).click();

	await expect(page).toHaveURL(/\/destinations\/destination-created-\d+\/general$/);
	await expect(page.getByRole('heading', { name: 'Edge destination', exact: true })).toBeVisible();
	expect(await page.content()).not.toMatch(/destination-(?:create|detail)-fixture-secret/);
	await page.getByLabel('Name', { exact: true }).fill('Renamed destination');
	await page.getByRole('button', { name: 'Save destination' }).click();
	await expect(page.getByRole('status')).toHaveText('Destination name saved.');
	await expect(
		page.getByRole('heading', { name: 'Renamed destination', exact: true })
	).toBeVisible();
	expect(await page.content()).not.toContain('destination-update-fixture-secret');

	await page.getByRole('link', { name: 'Danger zone' }).click();
	await page.getByLabel(/Type Renamed destination/).fill('Renamed destination');
	await page.getByRole('button', { name: 'Delete destination permanently' }).click();
	await expect(page).toHaveURL('/destinations');

	await page.goto('/destinations/destination-1/danger');
	await expect(page.getByText('The default Coolify destination cannot be deleted.')).toBeVisible();
	await expect(page.getByRole('button', { name: /Delete destination/ })).toHaveCount(0);
});

test('server core uses physical settings, safe resources, domains and confirmed validation', async ({
	page
}) => {
	await login(page);
	await page.goto('/servers/server-1');
	await expect(page).toHaveURL('/servers/server-1/general');
	await expect(page.getByRole('heading', { name: 'Primary server', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'General', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	expect(await page.content()).not.toMatch(/server-(?:proxy|sentinel)-fixture-secret/);

	await page.getByLabel('Name', { exact: true }).fill('Edge server');
	await page.getByLabel('Description').fill('Updated deployment host');
	await page.getByLabel('SSH port').fill('2222');
	await page.getByLabel('SSH user').fill('deploy');
	await page.getByRole('button', { name: 'Save server' }).click();
	await expect(page.getByRole('status')).toHaveText('Server settings saved.');
	await expect(page.getByRole('heading', { name: 'Edge server', exact: true })).toBeVisible();
	expect(await page.content()).not.toContain('server-response-fixture-secret');

	await page.getByRole('link', { name: 'Environment variables', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/environment-variables');
	await expect(page.getByText('SERVER_REGION', { exact: true })).toBeVisible();
	expect(await page.content()).not.toContain('server-shared-fixture-secret');
	await page.getByRole('button', { name: 'Reveal value' }).click();
	await expect(page.getByText('server-shared-fixture-secret', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Hide value' }).click();
	expect(await page.content()).not.toContain('server-shared-fixture-secret');

	await page.getByRole('link', { name: 'Advanced', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/advanced');
	await page.getByLabel('Concurrent builds').fill('4');
	await page.getByRole('button', { name: 'Save advanced settings' }).click();
	await expect(page.getByRole('status')).toHaveText('Advanced server settings saved.');
	await expect(page.getByLabel('Concurrent builds')).toHaveValue('4');

	await page.getByRole('link', { name: 'Proxy', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/proxy');
	expect(await page.content()).not.toMatch(/proxy-(?:config|metadata|response)-fixture-secret/);
	await page.getByRole('button', { name: 'Reveal configuration' }).click();
	await expect(page.getByLabel('Docker Compose configuration')).toHaveValue(
		/proxy-config-fixture-secret/
	);
	await page.getByRole('button', { name: 'Hide configuration' }).click();
	expect(await page.content()).not.toContain('proxy-config-fixture-secret');
	await page.getByLabel(/Type RESTART PROXY/).fill('RESTART PROXY');
	await page.getByRole('button', { name: 'Restart proxy' }).click();
	await expect(page.getByRole('status')).toHaveText('Proxy restart queued.');
	expect(await page.content()).not.toContain('proxy-restart-fixture-secret');

	await page.getByRole('link', { name: 'Cloudflare Tunnel', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/cloudflare-tunnel');
	expect(await page.content()).not.toContain('tunnel-metadata-fixture-secret');
	await page.getByLabel(/Type ENABLE TUNNEL/).fill('ENABLE TUNNEL');
	await page.getByRole('button', { name: 'Enable tunnel state' }).click();
	await expect(page.getByRole('status')).toHaveText('Cloudflare Tunnel stored state enabled.');
	await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
	expect(await page.content()).not.toContain('tunnel-enable-fixture-secret');

	await page.getByRole('link', { name: 'Sentinel', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/sentinel');
	expect(await page.content()).not.toMatch(/sentinel-(?:api|extra|response)-fixture-secret/);
	await page.getByRole('button', { name: 'Reveal secrets' }).click();
	await expect(page.getByText('sentinel-api-fixture-secret', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Hide secrets' }).click();
	expect(await page.content()).not.toContain('sentinel-api-fixture-secret');
	await page.getByLabel(/Type SAVE SENTINEL/).fill('SAVE SENTINEL');
	await page.getByRole('button', { name: 'Save Sentinel settings' }).click();
	await expect(page.getByRole('status')).toHaveText('Sentinel settings saved.');

	await page.getByRole('link', { name: 'Log drains', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/log-drains');
	expect(await page.content()).not.toMatch(
		/(?:newrelic|axiom|custom-config|drains-extra|drains-response)-fixture-secret/
	);
	await page.getByRole('button', { name: 'Reveal secrets' }).click();
	await expect(page.getByText('newrelic-fixture-secret', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Hide secrets' }).click();
	await page.getByLabel(/Type SAVE LOG DRAINS/).fill('SAVE LOG DRAINS');
	await page.getByRole('button', { name: 'Save log drains' }).click();
	await expect(page.getByRole('status')).toHaveText('Log drain settings saved.');
	expect(await page.content()).not.toContain('drains-response-fixture-secret');

	await page.getByRole('link', { name: 'Docker cleanup', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/docker-cleanup');
	await expect(page.getByRole('row', { name: /Removed unused Docker images/ })).toBeVisible();
	expect(await page.content()).not.toMatch(
		/cleanup-(?:settings|execution|response|run-upstream)-fixture-secret/
	);
	await page.getByLabel(/Type RUN CLEANUP/).fill('RUN CLEANUP');
	await page.getByRole('button', { name: 'Run Docker cleanup' }).click();
	await expect(page.getByRole('status')).toHaveText('Docker cleanup started.');
	expect(await page.content()).not.toContain('cleanup-run-upstream-fixture-secret');

	await page.getByRole('link', { name: 'Resources', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/resources');
	await expect(page.getByRole('link', { name: 'Image App', exact: true })).toHaveAttribute(
		'href',
		'/applications/app-2/general'
	);
	await expect(page.getByRole('row', { name: /Primary DB/ })).toContainText('PostgreSQL');
	expect(await page.content()).not.toContain('server-resource-fixture-secret');

	await page.getByRole('link', { name: 'Domains', exact: true }).click();
	await expect(page.getByRole('row', { name: /10\.0\.0\.1/ })).toContainText('app.example.com');

	await page.getByRole('link', { name: 'Validation', exact: true }).click();
	await page.getByLabel('Install missing prerequisites and Docker', { exact: false }).check();
	await page.getByLabel('I confirm that server validation may run remote commands.').check();
	await page.getByRole('button', { name: 'Start validation' }).click();
	await expect(page.getByRole('status')).toHaveText('Server validation and installation started.');
	expect(await page.content()).not.toContain('upstream-server-validation-fixture-secret');

	await page.getByRole('link', { name: 'API availability', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/capabilities');
	await expect(
		page.getByRole('row', { name: /Transfer, migration and mailbox export/ })
	).toContainText('Development only');
	await expect(
		page.getByRole('row', { name: /Terminal, terminal access and server patching/ })
	).toContainText('No public API');

	await page.getByRole('link', { name: 'Danger zone', exact: true }).click();
	await expect(page).toHaveURL('/servers/server-1/danger');
	await expect(page.getByRole('button', { name: 'Delete server' })).toBeVisible();

	await page.goBack();
	await expect(page).toHaveURL('/servers/server-1/capabilities');
	await expect(page.getByRole('heading', { name: 'API availability', exact: true })).toBeVisible();
	await page.goBack();
	await expect(page).toHaveURL('/servers/server-1/validation');
	await expect(page.getByRole('heading', { name: 'Validation', exact: true })).toBeVisible();
});
