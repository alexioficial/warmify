import { collectionForPage } from '$lib/server/inventory-cache';
import { redactSecrets } from '$lib/server/redact';

import type { PageServerLoad } from './$types';

const searchable = [
	'projects',
	'applications',
	'services',
	'databases',
	'servers',
	'destinations'
] as const;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) return { query, results: [] };
	const normalized = query.toLowerCase();
	const groups = await Promise.all(
		searchable.map(async (group) => {
			try {
				const value = await collectionForPage(group);
				return Array.isArray(value)
					? value
							.filter((item) =>
								JSON.stringify(redactSecrets(item)).toLowerCase().includes(normalized)
							)
							.map((item) => ({ group, item: redactSecrets(item) as Record<string, unknown> }))
					: [];
			} catch {
				return [];
			}
		})
	);
	return { query, results: groups.flat() };
};
