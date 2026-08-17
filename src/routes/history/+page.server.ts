import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, reading, room } from '$lib/server/db/schema';
import { and, asc, eq, gte } from 'drizzle-orm';
import { getOrCreateSettings } from '$lib/server/settings';

const RANGE_TO_MS: Record<string, number> = {
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

// History is a continuous-mode concept: a trend over time for one room.
// If the device has been parked in different rooms at different times,
// each room has its own (possibly gappy) history — you pick which one to
// view instead of it trying to stitch rooms together into one line.
export const load: PageServerLoad = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const rangeMs = RANGE_TO_MS[range] ?? RANGE_TO_MS['24h'];
	const since = new Date(Date.now() - rangeMs);

	const settingsRow = await getOrCreateSettings();
	const rooms = await db.select().from(room).orderBy(room.sortOrder);

	const requestedRoomId = url.searchParams.get('room');
	const roomId = requestedRoomId ?? settingsRow.continuousRoomId ?? rooms[0]?.id ?? null;

	const rows = roomId
		? await db
				.select({
					temperatureC: reading.temperatureC,
					humidityPct: reading.humidityPct,
					pm1UgM3: reading.pm1UgM3,
					pm25UgM3: reading.pm25UgM3,
					pm10UgM3: reading.pm10UgM3,
					recordedAt: reading.recordedAt
				})
				.from(reading)
				.innerJoin(device, eq(reading.deviceId, device.id))
				.where(
					and(eq(reading.mode, 'continuous'), eq(reading.roomId, roomId), gte(reading.recordedAt, since))
				)
				.orderBy(asc(reading.recordedAt))
		: [];

	return { readings: rows, range, rooms, roomId };
};
