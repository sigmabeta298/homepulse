import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { and, asc, eq, gte } from 'drizzle-orm';

const RANGE_TO_MS: Record<string, number> = {
	'1h': 1 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

// GET /api/readings/history?range=24h[&device=slug]
// range is one of: 1h, 24h, 7d, 30d (defaults to 24h)
export const GET: RequestHandler = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const deviceSlug = url.searchParams.get('device');

	const rangeMs = RANGE_TO_MS[range];
	if (!rangeMs) {
		throw error(400, `Invalid range. Use one of: ${Object.keys(RANGE_TO_MS).join(', ')}`);
	}

	const since = new Date(Date.now() - rangeMs);

	const base = db
		.select({
			id: reading.id,
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

	const whereClause = deviceSlug
		? and(gte(reading.recordedAt, since), eq(device.slug, deviceSlug))
		: gte(reading.recordedAt, since);

	const rows = await base.where(whereClause).orderBy(asc(reading.recordedAt));

	return json({ range, readings: rows });
};
