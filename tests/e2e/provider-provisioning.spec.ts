import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const headers = { Authorization: 'Bearer 1|e2e-secret' };

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function removeCreatedServer(request: APIRequestContext) {
	await request.delete('http://127.0.0.1:4010/api/v1/servers/server-created', { headers });
}

test.afterEach(async ({ request }) => removeCreatedServer(request));

test('provisions each supported provider only after typed billable confirmation', async ({
	page,
	request
}) => {
	await login(page);
	await page.goto('/servers/new');
	await expect(page.getByRole('link', { name: 'Hetzner' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'DigitalOcean' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Vultr' })).toBeVisible();

	const cases = [
		{
			provider: 'digitalocean',
			label: 'DigitalOcean',
			token: 'DigitalOcean test token',
			name: 'e2e-do',
			region: 'nyc3',
			size: 's-1vcpu-1gb',
			image: 'ubuntu-24-04-x64',
			script: true
		},
		{
			provider: 'hetzner',
			label: 'Hetzner',
			token: 'Production Hetzner',
			name: 'e2e-hz',
			region: 'nbg1',
			size: 'cx22',
			image: '201',
			script: false
		},
		{
			provider: 'vultr',
			label: 'Vultr',
			token: 'Vultr test token',
			name: 'e2e-vu',
			region: 'ewr',
			size: 'vc2-1c-1gb',
			image: '301',
			script: false
		}
	];

	for (const item of cases) {
		await page.goto(`/servers/new/cloud/${item.provider}`);
		await page.getByLabel(`${item.label} token`).selectOption({ label: item.token });
		await page.getByRole('button', { name: 'Load provider options' }).click();
		await expect(page.getByRole('heading', { name: '2. Server configuration' })).toBeVisible();
		expect(await page.content()).not.toMatch(
			/provider-public-key-fixture-secret|(?:digitalocean|vultr)-token-list-fixture-secret/
		);

		await page.getByLabel('Hostname').fill(item.name);
		await page.getByLabel('Private key').selectOption('key-1');
		await page.getByLabel('Region').selectOption(item.region);
		await page.getByLabel('Server size').selectOption(item.size);
		await page.getByLabel('Operating system image').selectOption(item.image);
		if (item.script)
			await page.getByLabel('Reusable cloud-init script').selectOption('cloud-init-1');
		await page
			.getByLabel(new RegExp(`Type PROVISION ${item.label.toUpperCase()} ${item.name}`))
			.fill(`PROVISION ${item.label.toUpperCase()} ${item.name}`);
		await page.getByRole('button', { name: `Provision ${item.label} server` }).click();
		await expect(page).toHaveURL('/servers/server-created/general');
		await expect(page.getByRole('heading', { name: item.name })).toBeVisible();
		expect(await page.content()).not.toMatch(
			/cloud-init-detail-fixture-secret|provider-create-fixture-secret/
		);
		await removeCreatedServer(request);
	}
});
