import { revealServerSharedVariable } from '$lib/server/shared-variables';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = revealServerSharedVariable;
