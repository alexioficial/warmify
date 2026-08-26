import { redirect } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete('warmify_session', { path: '/' });
	redirect(303, '/login');
};
