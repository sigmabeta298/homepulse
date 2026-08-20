import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (session?.user) {
		const to = event.url.searchParams.get('from') || '/';
		throw redirect(303, to);
	}

	const deniedReason = event.url.searchParams.get('error');
	return { denied: deniedReason === 'AccessDenied' };
};
