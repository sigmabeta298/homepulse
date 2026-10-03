import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscription } from '$lib/server/db/schema';
import { getVapidPublicKey, isPushConfigured, parsePushSubscription } from '$lib/server/push';

async function getUserEmail(locals: App.Locals): Promise<string> {
	const session = await locals.auth();
	if (!session?.user?.email) throw error(401, 'Unauthorized');
	return session.user.email.toLowerCase();
}

export const GET: RequestHandler = async ({ locals }) => {
	const userEmail = await getUserEmail(locals);
	const [result] = await db
		.select({ total: count() })
		.from(pushSubscription)
		.where(eq(pushSubscription.userEmail, userEmail));

	return json(
		{
			configured: isPushConfigured(),
			publicKey: getVapidPublicKey(),
			subscriptionCount: result.total
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const userEmail = await getUserEmail(locals);
	const body: unknown = await request.json().catch(() => null);
	const subscription = parsePushSubscription(body);
	if (!subscription) throw error(400, 'Invalid push subscription');

	await db
		.insert(pushSubscription)
		.values({ ...subscription, userEmail })
		.onConflictDoNothing({ target: pushSubscription.endpoint });

	const [savedSubscription] = await db
		.select({ userEmail: pushSubscription.userEmail })
		.from(pushSubscription)
		.where(eq(pushSubscription.endpoint, subscription.endpoint))
		.limit(1);
	if (savedSubscription?.userEmail !== userEmail) {
		throw error(409, 'This browser subscription belongs to another account.');
	}

	return json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const userEmail = await getUserEmail(locals);
	const body: unknown = await request.json().catch(() => null);
	const endpoint =
		body && typeof body === 'object' && 'endpoint' in body && typeof body.endpoint === 'string'
			? body.endpoint
			: null;
	if (!endpoint || endpoint.length > 2048)
		throw error(400, 'A valid subscription endpoint is required');

	await db
		.delete(pushSubscription)
		.where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userEmail, userEmail)));

	return json({ ok: true });
};
