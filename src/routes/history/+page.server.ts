import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, monthlySummary, reading, room } from '$lib/server/db/schema';
import { and, asc, eq, gte } from 'drizzle-orm';
import { getOrCreateSettings } from '$lib/server/settings';

const RANGE_TO_MS: Record<string, number> = {
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000
};

// Raw readings only ever cover "24h", "7d", and the still-in-progress
// current month - anything older than that has already been rotated into
// monthlySummary by retention.ts, so a plain gte(recordedAt, since) query
// (like the old fixed "30d" range) would silently go empty once rotation
// has run. "historic" reads monthlySummary instead, one point per
// completed month, going back as far as data exists.
function startOfCurrentMonth(now = new Date()) {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// History is a continuous-mode concept: a trend over time for one room.
// If the device has been parked in different rooms at different times,
// each room has its own (possibly gappy) history — you pick which one to
// view instead of it trying to stitch rooms together into one line.
export const load: PageServerLoad = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';

	const settingsRow = await getOrCreateSettings();
	const rooms = await db.select().from(room).orderBy(room.sortOrder);

	const requestedRoomId = url.searchParams.get('room');
	const roomId = requestedRoomId ?? settingsRow.continuousRoomId ?? rooms[0]?.id ?? null;

	if (!roomId) {
		return { view: 'readings' as const, readings: [], range, rooms, roomId };
	}

	if (range === 'historic') {
		const summaries = await db
			.select()
			.from(monthlySummary)
			.where(eq(monthlySummary.roomId, roomId))
			.orderBy(asc(monthlySummary.year), asc(monthlySummary.month));

		return { view: 'historic' as const, summaries, range, rooms, roomId };
	}

	// 'month' shows every raw reading recorded so far in the current
	// calendar month (grows day by day until rotation sweeps it into a
	// monthlySummary row at month-end). '24h'/'7d' are rolling windows.
	const since = range === 'month' ? startOfCurrentMonth() : new Date(Date.now() - (RANGE_TO_MS[range] ?? RANGE_TO_MS['24h']));

	const rows = await db
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
		.where(and(eq(reading.mode, 'continuous'), eq(reading.roomId, roomId), gte(reading.recordedAt, since)))
		.orderBy(asc(reading.recordedAt));

	return { view: 'readings' as const, readings: rows, range, rooms, roomId };
};
