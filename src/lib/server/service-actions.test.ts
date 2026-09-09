import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { CoolifyError } from './coolify-client';
const request = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ getCoolifyClient: () => ({ request }), audit: vi.fn() }));
vi.mock('./inventory-cache', () => ({ invalidateCollection: vi.fn() }));
import {
	createServiceDangerActions,
	createServiceDomainActions,
	createServiceOperationActions
} from './service-operations';
import { createStorageActions } from './application-storage-actions';
import { createServiceSubresourceActions } from './service-subresources';

function event(values: Record<string, string>): RequestEvent {
	const body = new FormData();
	for (const [key, value] of Object.entries(values)) body.set(key, value);
	return {
		params: { uuid: 'service-1', application: 'web-1' },
		locals: { user: { username: 'admin' } },
		request: new Request('http://localhost/service', { method: 'POST', body })
	} as unknown as RequestEvent;
}
beforeEach(() => {
	request.mockReset();
});
describe('service server actions', () => {
	test('blocks cloning without the exact current service name', async () => {
		request.mockResolvedValue({ name: 'Current Name' });
		const result = await createServiceOperationActions().cloneService(
			event({ confirmation: 'clone old name', destination_uuid: 'dest' })
		);
		expect(result).toMatchObject({ status: 400 });
		expect(request.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(0);
	});
	test('preserves domain inputs on a 409 and never forces the initial request', async () => {
		request
			.mockResolvedValueOnce({ applications: [{ name: 'web' }] })
			.mockRejectedValueOnce(new CoolifyError('Conflict', 409));
		const result = await createServiceDomainActions().saveDomains(
			event({ name: 'web', url: 'https://example.com' })
		);
		expect(result).toMatchObject({
			status: 409,
			data: { conflict: true, rows: [{ name: 'web', url: 'https://example.com' }] }
		});
		expect(request).toHaveBeenLastCalledWith('PATCH', '/services/service-1', {
			body: { urls: [{ name: 'web', url: 'https://example.com' }] }
		});
	});
	test('requires a container on service storage creation', async () => {
		const actions = createStorageActions('services');
		expect(
			await actions.createStorage(event({ kind: 'persistent', name: 'data', mount_path: '/data' }))
		).toMatchObject({ status: 400 });
		expect(request).not.toHaveBeenCalled();
		request.mockResolvedValue({ uuid: 'volume' });
		await actions.createStorage(
			event({ kind: 'persistent', name: 'data', mount_path: '/data', resource_uuid: 'web-1' })
		);
		expect(request).toHaveBeenCalledWith('POST', '/services/service-1/storages', {
			body: { type: 'persistent', name: 'data', mount_path: '/data', resource_uuid: 'web-1' }
		});
	});
	test('rejects non-string noindex members before sending a subresource patch', async () => {
		expect(
			await createServiceSubresourceActions('applications').save(event({ noindex_domains: '[1]' }))
		).toMatchObject({ status: 400 });
		expect(request).not.toHaveBeenCalled();
	});
	test('blocks deletion without exact confirmation', async () => {
		request.mockResolvedValue({ name: 'Stack' });
		expect(
			await createServiceDangerActions().deleteService(event({ confirmation: 'yes' }))
		).toMatchObject({ status: 400 });
		expect(request.mock.calls.filter(([method]) => method === 'DELETE')).toHaveLength(0);
	});
	test('sends explicit cleanup flags only after confirmed deletion', async () => {
		request.mockResolvedValueOnce({ name: 'Stack' }).mockResolvedValueOnce({});
		await expect(
			createServiceDangerActions().deleteService(
				event({
					confirmation: 'Stack',
					delete_volumes: 'true'
				})
			)
		).rejects.toMatchObject({ status: 303, location: '/projects' });
		expect(request).toHaveBeenLastCalledWith('DELETE', '/services/service-1', {
			query: {
				delete_configurations: false,
				delete_volumes: true,
				docker_cleanup: false,
				delete_connected_networks: false
			}
		});
	});
	test('maps unsupported nested lifecycle operations to an unavailable capability', async () => {
		request.mockRejectedValue(new CoolifyError('Internal Swarm detail', 501));
		expect(
			await createServiceSubresourceActions('applications').lifecycle(event({ action: 'start' }))
		).toMatchObject({
			status: 501,
			data: { error: 'This operation or resource is unavailable on this Coolify installation.' }
		});
	});
});
