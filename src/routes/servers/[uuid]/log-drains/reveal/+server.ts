import { revealLogDrainSecrets } from '$lib/server/server-log-drains';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = revealLogDrainSecrets;
