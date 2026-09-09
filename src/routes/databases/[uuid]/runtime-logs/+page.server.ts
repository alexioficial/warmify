import { getCoolifyClient } from '$lib/server/runtime';
import { redactSecrets } from '$lib/server/redact';
import { databaseFailure } from '$lib/server/database-pages';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ params }) => {
	try {
		return {
			logs: redactSecrets(
				await getCoolifyClient().request(
					'GET',
					`/databases/${encodeURIComponent(params.uuid)}/logs`,
					{ query: { lines: 100, show_timestamps: false } }
				)
			)
		};
	} catch (caught) {
		const failure = databaseFailure(caught);
		return {
			logs: undefined,
			requestFailure: {
				message: failure.error,
				status: failure.status,
				retryable: failure.status === 429 || failure.status >= 500
			}
		};
	}
};
