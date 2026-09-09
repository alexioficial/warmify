import { error, fail, isHttpError, type RequestEvent } from '@sveltejs/kit';

import { teamView } from '$lib/administration-presenter';
import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from './coolify-client';
import { audit, getCoolifyClient } from './runtime';

function responseText(value: unknown, keys: string[]) {
	if (typeof value === 'string') return value.trim();
	return firstText(asRecord(value), keys);
}

export async function loadSystemPage(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store' });
	const client = getCoolifyClient();
	const [healthResult, versionResult, teamResult] = await Promise.allSettled([
		client.request('GET', '/health'),
		client.request('GET', '/version'),
		client.request('GET', '/team')
	]);
	const health =
		healthResult.status === 'fulfilled'
			? responseText(healthResult.value, ['status', 'message'])
			: '';
	const version =
		versionResult.status === 'fulfilled'
			? responseText(versionResult.value, ['version']) || 'Unavailable'
			: 'Unavailable';
	const team = teamResult.status === 'fulfilled' ? teamView(teamResult.value) : undefined;
	return {
		health: health || 'Unavailable',
		version,
		apiAvailable: versionResult.status === 'fulfilled',
		rootTeam: team ? team.id === '0' : null,
		teamName: team?.name ?? '',
		apiState: 'unavailable' as const,
		mcpState: 'unavailable' as const
	};
}

function status(caught: unknown) {
	const value = caught instanceof CoolifyError || isHttpError(caught) ? caught.status : 500;
	return value >= 400 && value <= 599 ? value : 500;
}

function assertMutation(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required.');
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
}

async function assertRootTeam() {
	const team = teamView(await getCoolifyClient().request('GET', '/team'));
	if (!team || team.id !== '0') error(403, 'A root-team API token is required for this action.');
}

interface SystemOperation {
	name: string;
	confirmation: string;
	path: '/enable' | '/disable' | '/mcp/enable' | '/mcp/disable';
	requireRootCheck: boolean;
	message: string;
}

async function runSystemOperation(event: RequestEvent, operation: SystemOperation) {
	const started = Date.now();
	try {
		assertMutation(event);
		const form = await event.request.formData();
		if (String(form.get('confirmation') ?? '').trim() !== operation.confirmation)
			error(400, `Type ${operation.confirmation} exactly to confirm.`);
		if (operation.requireRootCheck) await assertRootTeam();
		await getCoolifyClient().request('POST', operation.path);
		audit({
			user: event.locals.user?.username,
			operation: operation.name,
			result: 'success',
			duration_ms: Date.now() - started
		});
		return { message: operation.message };
	} catch (caught) {
		audit({
			user: event.locals.user?.username,
			operation: operation.name,
			result: 'error',
			duration_ms: Date.now() - started
		});
		return fail(status(caught), {
			error: isHttpError(caught)
				? caught.body.message
				: `${operation.name.includes('mcp') ? 'MCP server' : 'Coolify API'} request failed. No automatic retry was attempted.`
		});
	}
}

export const systemActions = {
	enableApi: (event: RequestEvent) =>
		runSystemOperation(event, {
			name: 'enable-coolify-api',
			confirmation: 'ENABLE API',
			path: '/enable',
			requireRootCheck: false,
			message: 'Coolify API enable request completed.'
		}),
	disableApi: (event: RequestEvent) =>
		runSystemOperation(event, {
			name: 'disable-coolify-api',
			confirmation: 'DISABLE API',
			path: '/disable',
			requireRootCheck: true,
			message: 'Coolify API disabled. Warmify cannot manage resources until it is enabled again.'
		}),
	enableMcp: (event: RequestEvent) =>
		runSystemOperation(event, {
			name: 'enable-coolify-mcp',
			confirmation: 'ENABLE MCP',
			path: '/mcp/enable',
			requireRootCheck: true,
			message: 'Coolify MCP server enable request completed.'
		}),
	disableMcp: (event: RequestEvent) =>
		runSystemOperation(event, {
			name: 'disable-coolify-mcp',
			confirmation: 'DISABLE MCP',
			path: '/mcp/disable',
			requireRootCheck: true,
			message: 'Coolify MCP server disable request completed.'
		})
};
