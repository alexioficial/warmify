import { revealSentinelSecrets } from '$lib/server/server-sentinel';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = revealSentinelSecrets;
