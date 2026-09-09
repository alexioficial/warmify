import { error, type RequestEvent } from '@sveltejs/kit';

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/;
const SUB_SERVICE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;

export function assertInternalUser(event: Pick<RequestEvent, 'locals'>) {
	if (!event.locals.user) error(401, 'Authentication required.');
	return event.locals.user;
}

export function assertSameOrigin(event: Pick<RequestEvent, 'locals' | 'request' | 'url'>) {
	const user = assertInternalUser(event);
	if (event.request.headers.get('origin') !== event.url.origin)
		error(403, 'Same-origin request required.');
	return user;
}

export function boundedPollIdentifier(value: string, allowActive = false): string {
	if (value === 'active') {
		if (allowActive) return value;
		error(400, 'Invalid polling identifier.');
	}
	if (IDENTIFIER.test(value)) return value;
	error(400, 'Invalid polling identifier.');
}

export function boundedSubServiceName(value: string): string {
	if (SUB_SERVICE_NAME.test(value)) return value;
	error(400, 'Invalid service name.');
}

export function boundedSearchQuery(value: string): string {
	return value.trim().slice(0, 200);
}
