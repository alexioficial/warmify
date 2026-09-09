import { createPrivateKey } from '$lib/server/administration-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	breadcrumbs: [
		{ label: 'Private keys', href: '/security/keys' },
		{ label: 'New private key', href: '/security/keys/new' }
	]
});

export const actions: Actions = { create: createPrivateKey };
