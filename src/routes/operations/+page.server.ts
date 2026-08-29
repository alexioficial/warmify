import { endpointManifest } from '$lib/server/endpoint-manifest';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const groups = Object.entries(
		endpointManifest.reduce<Record<string, number>>((counts, endpoint) => {
			counts[endpoint.group] = (counts[endpoint.group] ?? 0) + 1;
			return counts;
		}, {})
	).map(([name, count]) => ({ name, count }));
	return { groups };
};
