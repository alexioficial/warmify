import { asRecord, firstText } from '$lib/resource-presenter';
import { CoolifyError } from '$lib/server/coolify-client';
import { getCoolifyClient } from '$lib/server/runtime';

export const CAPABILITY_VERSION_TTL_MS = 5 * 60_000;
const UNAVAILABLE_REASON = 'This capability is unavailable on the connected Coolify version.';

interface VersionCache {
	version: string;
	expiresAt: number;
}

export type CapabilityResult<T> =
	| { available: true; version: string; value: T }
	| { available: false; version: string; reason: string };

let versionCache: VersionCache | undefined;
let versionRequest: Promise<string> | undefined;
const learnedCapabilities = new Map<string, 'available' | 'unavailable'>();

function versionText(value: unknown): string {
	if (typeof value === 'string' && value.trim()) return value.trim();
	return firstText(asRecord(value), ['version']) || 'unknown';
}

async function detectCoolifyVersion(): Promise<string> {
	if (versionCache && versionCache.expiresAt > Date.now()) return versionCache.version;
	if (versionRequest) return versionRequest;
	versionRequest = getCoolifyClient()
		.request('GET', '/version')
		.then(versionText)
		.catch(() => 'unknown')
		.then((version) => {
			if (versionCache?.version !== version) learnedCapabilities.clear();
			versionCache = { version, expiresAt: Date.now() + CAPABILITY_VERSION_TTL_MS };
			return version;
		})
		.finally(() => {
			versionRequest = undefined;
		});
	return versionRequest;
}

export function capabilityUnavailable(caught: unknown): boolean {
	return caught instanceof CoolifyError && [404, 405, 501].includes(caught.status);
}

export async function requestCapability<T>(
	capability: string,
	request: () => Promise<T>
): Promise<CapabilityResult<T>> {
	const version = await detectCoolifyVersion();
	const key = `${version}:${capability}`;
	if (learnedCapabilities.get(key) === 'unavailable') {
		return { available: false, version, reason: UNAVAILABLE_REASON };
	}
	try {
		const value = await request();
		learnedCapabilities.set(key, 'available');
		return { available: true, version, value };
	} catch (caught) {
		if (!capabilityUnavailable(caught)) throw caught;
		learnedCapabilities.set(key, 'unavailable');
		return { available: false, version, reason: UNAVAILABLE_REASON };
	}
}

export function resetCapabilityDetection(): void {
	versionCache = undefined;
	versionRequest = undefined;
	learnedCapabilities.clear();
}
