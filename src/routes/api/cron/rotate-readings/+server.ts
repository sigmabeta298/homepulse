import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { rotateCompletedMonths } from '$lib/server/retention';

// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`
// when a CRON_SECRET project env var is set - checking it here is what
// stops anyone else (or a stray bot) from triggering/hammering this
// endpoint. This route is deliberately exempted from the login gate in
// hooks.server.ts (same reasoning as /api/ingest: Vercel's cron dispatcher
// has no browser session to log in with).
export const GET: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
		throw error(401, 'Unauthorized');
	}

	const result = await rotateCompletedMonths();
	return json({ ok: true, ...result });
};
