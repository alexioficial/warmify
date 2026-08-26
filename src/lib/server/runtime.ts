import { env } from '$env/dynamic/private';

import { CoolifyClient } from './coolify-client';
import { loadConfig, type WarmifyConfig } from './config';

let cachedConfig: WarmifyConfig | undefined;
let cachedClient: CoolifyClient | undefined;

export function getConfig(): WarmifyConfig {
	cachedConfig ??= loadConfig(env);
	return cachedConfig;
}

export function getCoolifyClient(): CoolifyClient {
	if (!cachedClient) {
		const config = getConfig();
		cachedClient = new CoolifyClient({
			baseUrl: config.coolifyBaseUrl,
			token: config.coolifyApiToken,
			timeoutMs: config.requestTimeoutMs
		});
	}
	return cachedClient;
}

export function audit(event: Record<string, string | number | boolean | undefined>): void {
	console.info(
		JSON.stringify({ timestamp: new Date().toISOString(), source: 'warmify', ...event })
	);
}
