import { loadNotificationChannel, updateNotificationChannel } from '$lib/server/notification-pages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadNotificationChannel(event);
export const actions = { update: updateNotificationChannel } satisfies Actions;
