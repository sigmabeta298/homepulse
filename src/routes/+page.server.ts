import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, reading, room } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getOrCreateSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const settingsRow = await getOrCreateSettings();
	const thresholds = {
		aqiThreshold: settingsRow.aqiThreshold,
		tempHighThresholdC: settingsRow.tempHighThresholdC
	};

	// The dashboard only really means something in continuous mode: "here's
	// the latest reading for the room I'm parked in." In spot-check mode
	// there's no single "current" room, so we just tell the page that and
	// point the user to Compare instead.
	if (settingsRow.mode !== 'continuous' || !settingsRow.continuousRoomId) {
		return { mode: settingsRow.mode, latest: null, roomName: null, ...thresholds };
	}

	const [parkedRoom] = await db.select().from(room).where(eq(room.id, settingsRow.continuousRoomId));

	const [latest] = await db
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
		.where(and(eq(reading.mode, 'continuous'), eq(reading.roomId, settingsRow.continuousRoomId)))
		.orderBy(desc(reading.recordedAt))
		.limit(1);

	return {
		mode: settingsRow.mode,
		latest: latest ?? null,
		roomName: parkedRoom?.name ?? null,
		...thresholds
	};
};
