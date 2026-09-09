import { beforeEach, expect, test, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
const write = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }) }));
vi.mock('./cache-database', () => ({
	readCache: () => undefined,
	writeCache: write,
	deleteCache: vi.fn()
}));
import { synchronizeCollection } from './inventory-cache';

beforeEach(() => {
	request.mockReset();
	write.mockReset();
});

test('deployment synchronization writes only normalized metadata at the SQLite boundary', async () => {
	request.mockResolvedValue({
		4: {
			deployment_uuid: 'd1',
			status: 'queued',
			logs: 'log-secret',
			configuration_snapshot: { value: 'snapshot-secret' }
		}
	});
	const result = await synchronizeCollection('deployments', true);
	expect(result).toEqual([{ deployment_uuid: 'd1', status: 'queued' }]);
	expect(write).toHaveBeenCalledWith('collection:deployments', [
		{ deployment_uuid: 'd1', status: 'queued' }
	]);
	expect(request).toHaveBeenCalledWith('GET', '/deployments');
});

test('source synchronization combines GitHub and GitLab while redacting credentials', async () => {
	request
		.mockResolvedValueOnce([{ id: 7, uuid: 'github-1', client_secret: 'github-secret' }])
		.mockResolvedValueOnce([{ id: 8, uuid: 'gitlab-1', access_token: 'gitlab-secret' }]);
	const result = await synchronizeCollection('sources', true);
	expect(result).toEqual([
		{ id: 7, uuid: 'github-1', client_secret: '[REDACTED]', provider: 'github' },
		{ id: 8, uuid: 'gitlab-1', access_token: '[REDACTED]', provider: 'gitlab' }
	]);
	expect(request.mock.calls).toEqual([
		['GET', '/github-apps'],
		['GET', '/gitlab-apps']
	]);
	expect(write).toHaveBeenLastCalledWith('collection:sources', result);
});
