import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { device, reading } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getOrCreateSettings } from '$lib/server/settings';

// Continuous mode: the device posts on a timer, so "no reading in the last
// 10 minutes" is a meaningful sign something's wrong.
const CONTINUOUS_ONLINE_WINDOW_MS = 10 * 60 * 1000;

// Spot mode: the device only posts when you press the button in a room,
// which could legitimately be hours or days apart. We don't call it
// "offline" just because it's been quiet — only flag it if it's been
// suspiciously long, since that's more likely a dead device/API key than
// a device that simply hasn't been walked around lately.
const SPOT_STALE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async () => {
	const settingsRow = await getOrCreateSettings();
	const devices = await db.select().from(device);

	const devicesWithStatus = await Promise.all(
		devices.map(async (d) => {
			const [latest] = await db
				.select()
				.from(reading)
				.where(eq(reading.deviceId, d.id))
				.orderBy(desc(reading.recordedAt))
				.limit(1);

			const msSinceLatest = latest ? Date.now() - new Date(latest.recordedAt).getTime() : null;

			// Status is one of: 'online' (continuous, recently heard from),
			// 'offline' (continuous, gone quiet), 'quiet' (spot mode, hasn't
			// captured in a while — normal), 'stale' (spot mode, suspiciously
			// long silence — worth checking on).
			let status: 'online' | 'offline' | 'quiet' | 'stale';
			if (settingsRow.mode === 'continuous') {
				status = msSinceLatest !== null && msSinceLatest < CONTINUOUS_ONLINE_WINDOW_MS
					? 'online'
					: 'offline';
			} else {
				status = msSinceLatest !== null && msSinceLatest < SPOT_STALE_WINDOW_MS ? 'quiet' : 'stale';
			}

			return { ...d, latest: latest ?? null, status };
		})
	);

	return { mode: settingsRow.mode, devices: devicesWithStatus };
};

export const actions: Actions = {
	// Deletes a device and any readings attributed to it. Unlike room
	// deletion (which blocks if there's history, since rooms are meant to
	// persist long-term), devices are meant to be disposable - a stray
	// device from testing with a fake deviceSlug has no real value once
	// you know which one is your actual hardware. The confirmation
	// checkbox in the UI is the safeguard against deleting the wrong one
	// by accident, not a block on deleting real history.
	deleteDevice: async ({ request }) => {
		const form = await request.formData();
		const deviceId = form.get('deviceId');
		const confirmed = form.get('confirmed');

		if (typeof deviceId !== 'string' || !deviceId) {
			return fail(400, { deviceError: 'Missing device id' });
		}
		if (confirmed !== 'true') {
			return fail(400, { deviceError: 'Please confirm before deleting a device' });
		}

		await db.delete(reading).where(eq(reading.deviceId, deviceId));
		await db.delete(device).where(eq(device.id, deviceId));

		return { deviceDeleted: true };
	}
};
