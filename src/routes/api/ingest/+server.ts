import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { device, reading, armedRoom } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { ARM_WINDOW_MS, getOrCreateSettings, SETTINGS_ID } from '$lib/server/settings';

// Expected JSON body from the ESP32:
// {
//   "deviceSlug": "living-room",
//   "temperatureC": 22.5,
//   "humidityPct": 45.1,
//   "co2Ppm": 612,
//   "pm25UgM3": 8.2
// }
//
// Auth: header `x-api-key: <INGEST_API_KEY>`. Set INGEST_API_KEY in your
// .env locally and in Vercel's project env vars. The ESP32 sends the same
// value in every request.
//
// Which room a reading belongs to is decided here on the server, not by
// the firmware, based on the app's current mode:
//  - continuous mode: always tagged to settings.continuousRoomId
//  - spot mode: tagged to whichever room was armed via POST /api/arm
//    within the last ARM_WINDOW_MS. If nothing's armed (or it's gone
//    stale), the reading is stored with roomId = null ("unassigned") so
//    it can be tagged manually later instead of silently mislabeled.

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = request.headers.get('x-api-key');
	if (!env.INGEST_API_KEY || apiKey !== env.INGEST_API_KEY) {
		throw error(401, 'Invalid or missing API key');
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid JSON body');
	}

	const { deviceSlug, temperatureC, humidityPct, co2Ppm, pm25UgM3 } = body as Record<
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

	const settingsRow = await getOrCreateSettings();

	let roomId: string | null = null;
	let roundId: string | null = null;

	if (settingsRow.mode === 'continuous') {
		roomId = settingsRow.continuousRoomId ?? null;
	} else {
		// spot mode: consume the current arming if it's still fresh.
		const [armed] = await db.select().from(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));

		const isFresh =
			armed?.roomId && armed.armedAt && Date.now() - new Date(armed.armedAt).getTime() < ARM_WINDOW_MS;

		if (isFresh) {
			roomId = armed.roomId;
			roundId = armed.roundId;
			// Clear the arming so a stray second reading doesn't get
			// double-counted for the same room.
			await db
				.update(armedRoom)
				.set({ roomId: null, roundId: null, armedAt: null })
				.where(eq(armedRoom.id, SETTINGS_ID));
		}
	}

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
			co2Ppm: numOrNull(co2Ppm),
			pm25UgM3: numOrNull(pm25UgM3)
		})
		.returning();

	return json({ ok: true, reading: inserted }, { status: 201 });
};
