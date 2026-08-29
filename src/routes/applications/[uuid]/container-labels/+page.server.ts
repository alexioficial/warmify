import { createResourceActions } from '$lib/server/resource-detail-page';

import type { Actions } from './$types';

export const actions: Actions = createResourceActions('applications');
