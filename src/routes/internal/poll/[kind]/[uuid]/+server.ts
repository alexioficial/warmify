import { error, isHttpError, json } from '@sveltejs/kit';

import { CoolifyError } from '$lib/server/coolify-client';
import { requestCapability } from '$lib/server/capabilities';
import { redactSecrets } from '$lib/server/redact';
import { getCoolifyClient } from '$lib/server/runtime';
import { deploymentCollection } from '$lib/server/deployment-presenter';
import { deploymentSnapshot } from '$lib/server/deployment-detail';
import {
	assertInternalUser,
	boundedPollIdentifier,
	boundedSubServiceName
} from '$lib/server/internal-security';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { params, setHeaders, url } = event;
	assertInternalUser(event);
	const uuid = boundedPollIdentifier(params.uuid, params.kind === 'deployments');
	const fixedPaths: Record<string, string> = {
		deployments: uuid === 'active' ? '/deployments' : `/deployments/${encodeURIComponent(uuid)}`,
		'application-deployments': `/deployments/applications/${encodeURIComponent(uuid)}`,
		'application-logs': `/applications/${encodeURIComponent(uuid)}/logs`,
		'service-logs': `/services/${encodeURIComponent(uuid)}/logs`,
		'database-logs': `/databases/${encodeURIComponent(uuid)}/logs`,
		application: `/applications/${encodeURIComponent(uuid)}`,
		service: `/services/${encodeURIComponent(uuid)}`,
		database: `/databases/${encodeURIComponent(uuid)}`,
		server: `/servers/${encodeURIComponent(uuid)}`
	};
	const path = fixedPaths[params.kind];
	if (!path) error(404, 'Polling resource is not allowlisted');
	setHeaders({ 'cache-control': 'no-store' });
	const lines = Math.min(1000, Math.max(1, Number(url.searchParams.get('lines')) || 100));
	const query = params.kind.endsWith('-logs')
		? {
				lines,
				show_timestamps: url.searchParams.get('show_timestamps') === 'true',
				...(params.kind === 'service-logs' && url.searchParams.get('sub_service_name')
					? {
							sub_service_name: boundedSubServiceName(url.searchParams.get('sub_service_name')!)
						}
					: {})
			}
		: params.kind === 'application-deployments'
			? { take: 50 }
			: undefined;
	try {
		const capabilitySpecific =
			params.kind.endsWith('-logs') || params.kind === 'application-deployments';
		const capabilityScope = [
			params.kind,
			uuid,
			...(params.kind === 'service-logs' ? [url.searchParams.get('sub_service_name') ?? ''] : [])
		].join(':');
		const capability = capabilitySpecific
			? await requestCapability(capabilityScope, () =>
					getCoolifyClient().request('GET', path, { query })
				)
			: null;
		if (capability && !capability.available) {
			return json({ message: capability.reason, status: 404, unavailable: true }, { status: 404 });
		}
		const result = capability?.available
			? capability.value
			: await getCoolifyClient().request('GET', path, { query });
		return json(
			params.kind === 'deployments'
				? params.uuid === 'active'
					? deploymentCollection(result)
					: deploymentSnapshot(result, params.uuid)
				: redactSecrets(result)
		);
	} catch (caught) {
		const status = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
		const retryAfterSeconds = caught instanceof CoolifyError ? caught.retryAfterSeconds : undefined;
		return json(
			{
				message:
					caught instanceof CoolifyError && [404, 405, 501].includes(caught.status)
						? 'This live view is unavailable on the connected Coolify version.'
						: params.kind === 'deployments'
							? 'Deployment refresh failed. Check current activity before trying again.'
							: 'Coolify refresh failed.',
				status,
				...([404, 405, 501].includes(status) ? { unavailable: true } : {}),
				...(retryAfterSeconds ? { retryAfterSeconds } : {})
			},
			{
				status,
				headers: {
					...(retryAfterSeconds ? { 'retry-after': String(retryAfterSeconds) } : {})
				}
			}
		);
	}
};
