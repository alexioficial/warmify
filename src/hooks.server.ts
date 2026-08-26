import { redirect, type Handle } from '@sveltejs/kit';

import { verifySessionToken } from '$lib/server/auth';
import { getConfig } from '$lib/server/runtime';
import { isPublicPath } from '$lib/server/route-security';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	if (!isPublicPath(event.url.pathname)) {
		const config = getConfig();
		const session = verifySessionToken(event.cookies.get('warmify_session'), config.sessionSecret);
		if (!session)
			redirect(303, `/login?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`);
		event.locals.user = { username: session.username };
	}
	return resolve(event);
};
