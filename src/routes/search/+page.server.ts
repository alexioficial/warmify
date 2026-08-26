import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { PageServerLoad } from './$types';

const searchable = [
	['projects', '/projects'],
	['applications', '/applications'],
	['services', '/services'],
	['databases', '/databases'],
	['servers', '/servers'],
	['destinations', '/destinations']
] as const;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) return { query, results: [] };
	const normalized = query.toLowerCase();
	const groups = await Promise.all(
		searchable.map(async ([group, path]) => {
			try {
				const value = await getCoolifyClient().request('GET', path);
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
