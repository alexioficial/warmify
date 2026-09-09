import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	redirect(307, `/security/cloud-init-scripts/${encodeURIComponent(params.uuid)}/general`);
};
