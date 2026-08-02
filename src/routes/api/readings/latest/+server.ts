import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// GET /api/readings/latest            -> latest reading across all devices
// GET /api/readings/latest?device=slug -> latest reading for one device
export const GET: RequestHandler = async ({ url }) => {
	const deviceSlug = url.searchParams.get('device');

	const base = db
		.select({
			id: reading.id,
			deviceId: reading.deviceId,
			deviceName: device.name,
			temperatureC: reading.temperatureC,
			humidityPct: reading.humidityPct,
			co2Ppm: reading.co2Ppm,
			pm25UgM3: reading.pm25UgM3,
			recordedAt: reading.recordedAt
		})
		.from(reading)
		.innerJoin(device, eq(reading.deviceId, device.id))
		.$dynamic();

	const rows = await (deviceSlug ? base.where(eq(device.slug, deviceSlug)) : base)
		.orderBy(desc(reading.recordedAt))
		.limit(1);

	return json({ reading: rows[0] ?? null });
};
