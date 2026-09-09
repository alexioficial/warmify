import { revealProxyConfiguration } from '$lib/server/server-proxy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = revealProxyConfiguration;
