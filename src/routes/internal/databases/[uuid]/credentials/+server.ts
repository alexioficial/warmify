import { json } from '@sveltejs/kit';
import { databaseCredentials } from '$lib/server/database-presenter';
import { assertSameOrigin, boundedPollIdentifier } from '$lib/server/internal-security';
import { audit, getCoolifyClient } from '$lib/server/runtime';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
	const { params } = event;
	const user = assertSameOrigin(event);
	const uuid = boundedPollIdentifier(params.uuid);
	try {
		const database = await getCoolifyClient().request(
			'GET',
			`/databases/${encodeURIComponent(uuid)}`
		);
		audit({
			user: user.username,
			operation: 'reveal-database-credentials',
			result: 'secret-revealed'
		});
		return json(
			{ credentials: databaseCredentials(database) },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch {
		return json(
			{
				message:
					'Credentials could not be revealed. Verify that the API token permits sensitive reads.'
			},
			{ status: 502, headers: { 'cache-control': 'no-store' } }
		);
	}
};
