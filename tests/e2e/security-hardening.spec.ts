import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Username').fill('admin');
	await page.getByLabel('Password').fill('password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('protects internal JSON routes and sensitive reveals with session and origin checks', async ({
	page
}) => {
	const unauthenticated = await page.request.get('/internal/poll/dashboard');
	expect(unauthenticated.status()).toBe(401);

	await login(page);
	const crossOrigin = await page.request.post('/internal/reveal', {
		headers: { origin: 'https://attacker.example' },
		data: { operationId: 'GET:/security/keys', parameters: {} }
	});
	expect(crossOrigin.status()).toBe(403);
	expect(await crossOrigin.text()).not.toContain('private-key-fixture-secret');

	const invalidOperation = await page.request.post('/internal/reveal', {
		headers: { origin: 'http://127.0.0.1:4173' },
		data: { operationId: 'GET:/not-allowlisted-secret', parameters: {} }
	});
	expect(invalidOperation.status()).toBe(400);
	expect(await invalidOperation.json()).toEqual({
		message: 'The requested sensitive response could not be revealed.'
	});
});

test('bounds internal polling inputs and maps optional endpoint absence safely', async ({
	page
}) => {
	await login(page);
	const oversized = await page.request.get(`/internal/poll/application-logs/${'a'.repeat(256)}`);
	expect(oversized.status()).toBe(400);

	const unavailable = await page.request.get('/internal/poll/application-logs/missing-app');
	expect(unavailable.status()).toBe(404);
	const unavailableBody = await unavailable.json();
	expect(unavailableBody).toEqual({
		message: 'This capability is unavailable on the connected Coolify version.',
		status: 404,
		unavailable: true
	});
	expect(JSON.stringify(unavailableBody)).not.toMatch(/token|secret/i);
});
