import { fail, redirect } from '@sveltejs/kit';

import { createSessionToken, LoginRateLimiter, verifyPlainPassword } from '$lib/server/auth';
import { getConfig } from '$lib/server/runtime';

import type { Actions, PageServerLoad } from './$types';

const limiter = new LoginRateLimiter();

function safeReturnTo(value: string | null): string {
	return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, '/');
	return { returnTo: safeReturnTo(url.searchParams.get('returnTo')) };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const address = getClientAddress();
		if (!limiter.canAttempt(address))
			return fail(429, { error: 'Too many login attempts. Try again later.', username: '' });
		const data = await request.formData();
		const username = String(data.get('username') ?? '');
		const password = String(data.get('password') ?? '');
		const config = getConfig();
		const passwordMatches = verifyPlainPassword(password, config.adminPassword);
		if (username !== config.adminUsername || !passwordMatches) {
			limiter.recordFailure(address);
			return fail(400, { error: 'Invalid username or password.', username });
		}
		limiter.reset(address);
		const expiresAt = Date.now() + config.sessionTtlHours * 60 * 60_000;
		cookies.set('warmify_session', createSessionToken(username, expiresAt, config.sessionSecret), {
			httpOnly: true,
			sameSite: 'strict',
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			expires: new Date(expiresAt)
		});
		redirect(303, safeReturnTo(String(data.get('returnTo') ?? url.searchParams.get('returnTo'))));
	}
};
