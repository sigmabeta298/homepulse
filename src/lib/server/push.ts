import webPush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { Suggestion } from '$lib/server/environment-rules';
import { isEmailAllowed } from '$lib/server/auth-allowlist';
import { db } from '$lib/server/db';
import { pushSubscription } from '$lib/server/db/schema';

export function isPushConfigured(): boolean {
	return getVapidConfiguration() !== null;
}

export function getVapidPublicKey(): string | null {
	return getVapidConfiguration()?.publicKey ?? null;
}

function getVapidConfiguration() {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
	return {
		publicKey: VAPID_PUBLIC_KEY,
		privateKey: VAPID_PRIVATE_KEY,
		subject: VAPID_SUBJECT
	};
}

export type NewPushSubscription = {
	endpoint: string;
	p256dh: string;
	auth: string;
};

export function parsePushSubscription(value: unknown): NewPushSubscription | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.endpoint !== 'string' ||
		candidate.endpoint.length > 2048 ||
		typeof candidate.keys !== 'object' ||
		candidate.keys === null
	) {
		return null;
	}

	let endpoint: URL;
	try {
		endpoint = new URL(candidate.endpoint);
	} catch {
		return null;
	}
	const allowedPushHost =
		endpoint.hostname === 'fcm.googleapis.com' ||
		endpoint.hostname === 'web.push.apple.com' ||
		endpoint.hostname === 'updates.push.services.mozilla.com' ||
		endpoint.hostname.endsWith('.push.services.mozilla.com');
	if (endpoint.protocol !== 'https:' || !allowedPushHost) {
		return null;
	}

	const keys = candidate.keys as Record<string, unknown>;
	if (
		typeof keys.p256dh !== 'string' ||
		keys.p256dh.length === 0 ||
		keys.p256dh.length > 512 ||
		typeof keys.auth !== 'string' ||
		keys.auth.length === 0 ||
		keys.auth.length > 512
	) {
		return null;
	}

	return { endpoint: endpoint.toString(), p256dh: keys.p256dh, auth: keys.auth };
}

export async function sendWarningNotifications(
	suggestions: Suggestion[],
	roomName: string | null
): Promise<void> {
	if (suggestions.length === 0) return;
	const vapid = getVapidConfiguration();
	if (!vapid) {
		console.warn('Push notifications skipped: VAPID environment variables are not configured.');
		return;
	}

	try {
		webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
		const subscriptions = (await db.select().from(pushSubscription)).filter((subscription) =>
			isEmailAllowed(subscription.userEmail, env.ALLOWED_EMAILS)
		);
		if (subscriptions.length === 0) return;

		const title = roomName ? `HomePulse warning — ${roomName}` : 'HomePulse warning';
		const body = suggestions
			.map(
				(suggestion) =>
					`${suggestion.label}: ${suggestion.value}${suggestion.unit} — ${suggestion.message}`
			)
			.join('\n');
		const payload = JSON.stringify({ title, body, url: '/' });

		await Promise.all(
			subscriptions.map(async (subscription) => {
				try {
					await webPush.sendNotification(
						{
							endpoint: subscription.endpoint,
							keys: { p256dh: subscription.p256dh, auth: subscription.auth }
						},
						payload,
						{ TTL: 60 * 60 }
					);
				} catch (cause) {
					const statusCode =
						typeof cause === 'object' && cause !== null && 'statusCode' in cause
							? (cause as { statusCode?: number }).statusCode
							: undefined;
					if (statusCode === 404 || statusCode === 410) {
						await db
							.delete(pushSubscription)
							.where(eq(pushSubscription.endpoint, subscription.endpoint));
						return;
					}
					console.error('Push notification delivery failed.', cause);
				}
			})
		);
	} catch (cause) {
		console.error('Push notification processing failed.', cause);
	}
}
