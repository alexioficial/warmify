import { expect, test } from 'vitest';
import { serverNavigation } from '$lib/resource-routes';
import { serverCapabilities } from '$lib/server-capabilities';

test('server navigation exposes one explicit API availability route', () => {
	const items = serverNavigation().flatMap((group) => group.items);
	expect(items.filter((item) => item.slug === 'capabilities')).toEqual([
		{ slug: 'capabilities', label: 'API availability' }
	]);
});

test('unsupported server capabilities have an explicit reason and no action link', () => {
	const unavailable = serverCapabilities.filter((item) => item.status !== 'Available');
	expect(unavailable.length).toBeGreaterThan(0);
	expect(unavailable.every((item) => item.detail.length > 20 && item.href === undefined)).toBe(
		true
	);
	expect(unavailable.map((item) => item.name)).toEqual(
		expect.arrayContaining([
			'Transfer, migration and mailbox export',
			'Terminal, terminal access and server patching',
			'Metrics, proxy logs and Sentinel logs'
		])
	);
});
