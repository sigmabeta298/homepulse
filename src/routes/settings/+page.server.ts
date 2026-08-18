import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { settings, room, reading } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getOrCreateSettings, SETTINGS_ID } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const [settingsRow, rooms] = await Promise.all([
		getOrCreateSettings(),
		db.select().from(room).orderBy(room.sortOrder)
	]);
	return { settings: settingsRow, rooms };
};

function slugify(name: string) {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();

		const temperatureUnit = form.get('temperatureUnit');
		const refreshIntervalSeconds = Number(form.get('refreshIntervalSeconds'));
		const mode = form.get('mode');
		const continuousRoomIdRaw = form.get('continuousRoomId');
		const continuousRoomId =
			typeof continuousRoomIdRaw === 'string' && continuousRoomIdRaw ? continuousRoomIdRaw : null;

		if (temperatureUnit !== 'C' && temperatureUnit !== 'F') {
			return fail(400, { error: 'Invalid temperature unit' });
		}
		if (mode !== 'spot' && mode !== 'continuous') {
			return fail(400, { error: 'Invalid mode' });
		}
		if (!Number.isFinite(refreshIntervalSeconds)) {
			return fail(400, { error: 'Refresh interval must be a number' });
		}
		if (mode === 'continuous' && !continuousRoomId) {
			return fail(400, { error: 'Pick which room the device is parked in for Continuous mode' });
		}

		await getOrCreateSettings(); // ensure row exists before updating

		await db
			.update(settings)
			.set({
				temperatureUnit,
				refreshIntervalSeconds,
				mode,
				continuousRoomId
			})
			.where(eq(settings.id, SETTINGS_ID));

		return { success: true };
	},

	addRoom: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name');

		if (typeof name !== 'string' || !name.trim()) {
			return fail(400, { roomError: 'Room name is required' });
		}

		const slug = slugify(name);
		const existing = await db.select().from(room).where(eq(room.slug, slug));
		if (existing.length > 0) {
			return fail(400, { roomError: `A room named "${name}" already exists` });
		}

		const currentRooms = await db.select().from(room);
		const nextSortOrder = currentRooms.length;

		await db.insert(room).values({ name: name.trim(), slug, sortOrder: nextSortOrder });

		return { roomAdded: true };
	},

	deleteRoom: async ({ request }) => {
		const form = await request.formData();
		const roomId = form.get('roomId');
		if (typeof roomId !== 'string' || !roomId) {
			return fail(400, { roomError: 'Missing room id' });
		}

		// Readings reference rooms via a foreign key, so deleting a room that
		// already has history would violate that constraint. Rather than
		// destroying that history, block the delete and say so clearly.
		const [existingReading] = await db
			.select({ id: reading.id })
			.from(reading)
			.where(eq(reading.roomId, roomId))
			.limit(1);

		if (existingReading) {
			return fail(400, {
				roomError: 'This room has recorded readings, so it can\u2019t be deleted (that history would be lost). You can stop using it going forward instead.'
			});
		}

		await db.delete(room).where(eq(room.id, roomId));

		return { roomDeleted: true };
	},

	renameRoom: async ({ request }) => {
		const form = await request.formData();
		const roomId = form.get('roomId');
		const name = form.get('name');

		if (typeof roomId !== 'string' || !roomId) {
			return fail(400, { roomError: 'Missing room id' });
		}
		if (typeof name !== 'string' || !name.trim()) {
			return fail(400, { roomError: 'Room name is required' });
		}

		// Slug is left as-is on rename — it's only used internally for
		// add-time uniqueness, nothing else depends on it staying in sync
		// with the display name.
		await db.update(room).set({ name: name.trim() }).where(eq(room.id, roomId));

		return { roomRenamed: true };
	}
};
