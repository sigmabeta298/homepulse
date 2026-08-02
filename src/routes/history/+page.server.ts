import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { asc, eq, gte } from 'drizzle-orm';

const RANGE_TO_MS: Record<string, number> = {
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

export const load: PageServerLoad = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const rangeMs = RANGE_TO_MS[range] ?? RANGE_TO_MS['24h'];
	const since = new Date(Date.now() - rangeMs);

	const rows = await db
		.select({
			temperatureC: reading.temperatureC,
			humidityPct: reading.humidityPct,
			co2Ppm: reading.co2Ppm,
			pm25UgM3: reading.pm25UgM3,
			recordedAt: reading.recordedAt
		})
		.from(reading)
		.innerJoin(device, eq(reading.deviceId, device.id))
		.where(gte(reading.recordedAt, since))
		.orderBy(asc(reading.recordedAt));

	return { readings: rows, range };
};
