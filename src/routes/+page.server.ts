import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';

import type { PageServerLoad } from './$types';

async function safe(path: string, fallback: unknown) {
	try {
		return redactSecrets(await getCoolifyClient().request('GET', path));
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Coolify request failed', fallback };
	}
}

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const [projects, servers, deployments, version] = await Promise.all([
		safe('/projects', []),
		safe('/servers', []),
		safe('/deployments', []),
		safe('/version', null)
	]);
	return { projects, servers, deployments, version };
};
