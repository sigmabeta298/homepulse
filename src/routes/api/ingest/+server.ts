import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getOrCreateSettings } from '$lib/server/settings';
import { resolveRoomForReading } from '$lib/server/ingest';
import { isIngestAllowed } from '$lib/server/rate-limit';

// Expected JSON body from the ESP32:
// {
//   "deviceSlug": "living-room",
//   "temperatureC": 22.5,
//   "humidityPct": 45.1,
//   "pm1UgM3": 4.0,
//   "pm25UgM3": 8.2,
//   "pm10UgM3": 11.5
// }
//
// Auth: header `x-api-key: <INGEST_API_KEY>`. Set INGEST_API_KEY in your
// .env locally and in Vercel's project env vars. The ESP32 sends the same
// value in every request.
//
// Which room a reading belongs to is decided in resolveRoomForReading(),
// not by the firmware, based on the app's current mode - see that file
// for the continuous vs spot-mode logic.
//
// Rate limiting: a minimum gap is enforced per-device between accepted
// requests (see $lib/server/rate-limit.ts) - protects against a runaway
// firmware loop or endpoint abuse without getting in the way of any
// realistic legitimate use.

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = request.headers.get('x-api-key');
	if (!env.INGEST_API_KEY || apiKey !== env.INGEST_API_KEY) {
		throw error(401, 'Invalid or missing API key');
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid JSON body');
	}

	const { deviceSlug, temperatureC, humidityPct, pm1UgM3, pm25UgM3, pm10UgM3 } = body as Record<
		string,
		unknown
	>;

	if (typeof deviceSlug !== 'string' || deviceSlug.length === 0) {
		throw error(400, 'deviceSlug is required');
	}

	// Look up the device, creating it on first-ever reading so you don't
	// have to manually seed a row before your ESP32 can talk to this.
	let [existingDevice] = await db.select().from(device).where(eq(device.slug, deviceSlug));

	if (!existingDevice) {
		[existingDevice] = await db
			.insert(device)
			.values({ name: deviceSlug, slug: deviceSlug })
			.returning();
	}

	const now = new Date();
	if (!isIngestAllowed(existingDevice.lastIngestAt, now)) {
		throw error(429, 'Too many requests from this device - please slow down.');
	}

	const settingsRow = await getOrCreateSettings();
	const { roomId, roundId } = await resolveRoomForReading(settingsRow);

	const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

	const [inserted] = await db
		.insert(reading)
		.values({
			deviceId: existingDevice.id,
			roomId,
			roundId,
			mode: settingsRow.mode,
			temperatureC: numOrNull(temperatureC),
			humidityPct: numOrNull(humidityPct),
			pm1UgM3: numOrNull(pm1UgM3),
			pm25UgM3: numOrNull(pm25UgM3),
			pm10UgM3: numOrNull(pm10UgM3)
		})
		.returning();

	await db.update(device).set({ lastIngestAt: now }).where(eq(device.id, existingDevice.id));

	return json({ ok: true, reading: inserted }, { status: 201 });
};
