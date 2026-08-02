import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

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

	const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

	const [inserted] = await db
		.insert(reading)
		.values({
			deviceId: existingDevice.id,
			temperatureC: numOrNull(temperatureC),
			humidityPct: numOrNull(humidityPct),
			co2Ppm: numOrNull(co2Ppm),
			pm25UgM3: numOrNull(pm25UgM3)
		})
		.returning();

	return json({ ok: true, reading: inserted }, { status: 201 });
};
