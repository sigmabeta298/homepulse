import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// A device counts as "online" if it's sent a reading in the last 10 minutes.
// Tune this if your ESP32 reports on a longer interval.
const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export const load: PageServerLoad = async () => {
	const devices = await db.select().from(device);

	const devicesWithStatus = await Promise.all(
		devices.map(async (d) => {
			const [latest] = await db
				.select()
				.from(reading)
				.where(eq(reading.deviceId, d.id))
				.orderBy(desc(reading.recordedAt))
				.limit(1);

			const isOnline = latest
				? Date.now() - new Date(latest.recordedAt).getTime() < ONLINE_WINDOW_MS
				: false;

			return { ...d, latest: latest ?? null, isOnline };
		})
	);

	return { devices: devicesWithStatus };
};
