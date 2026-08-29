import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	use: { baseURL: 'http://127.0.0.1:4173' },
	webServer: [
		{
			command: 'bun run tests/mock-coolify.ts',
			port: 4010,
			reuseExistingServer: false
		},
		{
			command: 'bun run dev -- --host 127.0.0.1 --port 4173',
			port: 4173,
			reuseExistingServer: false,
			env: {
				COOLIFY_BASE_URL: 'http://127.0.0.1:4010',
				COOLIFY_API_TOKEN: '1|e2e-secret',
				WARMIFY_ADMIN_USERNAME: 'admin',
				WARMIFY_ADMIN_PASSWORD: 'password',
				WARMIFY_DATA_DIR: './test-results/e2e-data'
			}
		}
	]
});
