import { describe, expect, it, vi } from 'vitest';

import { executeOperation } from './operations';

describe('executeOperation', () => {
	it('builds and executes an allowlisted operation and redacts its response', async () => {
		const request = vi.fn(async () => ({ name: 'key', private_key: 'secret' }));
		const result = await executeOperation(
			{ request },
			{
				operationId: 'GET:/security/keys/{uuid}',
				parameters: { uuid: 'key-one' },
				query: {},
				body: undefined
			}
		);
		expect(request).toHaveBeenCalledWith('GET', '/security/keys/key-one', {});
		expect(result).toEqual({ name: 'key', private_key: '[REDACTED]' });
	});

	it('requires the resource identifier for delete confirmation', async () => {
		const request = vi.fn();
		await expect(
			executeOperation(
				{ request },
				{
					operationId: 'DELETE:/projects/{uuid}',
					parameters: { uuid: 'project-one' },
					query: {},
					body: undefined,
					confirmation: 'wrong'
				}
			)
		).rejects.toThrow('project-one');
		expect(request).not.toHaveBeenCalled();
	});
});
