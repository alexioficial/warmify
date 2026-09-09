import { revealPrivateKey } from '$lib/server/administration-pages';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = revealPrivateKey;
