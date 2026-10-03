import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { armedRoom, reading, room, round } from '$lib/server/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { ARM_WINDOW_MS, getOrCreateSettings, SETTINGS_ID } from '$lib/server/settings';
import { armRoomForSpotCheck, ArmError } from '$lib/server/arm';
import { evaluateReading } from '$lib/server/environment-rules';

export const load: PageServerLoad = async ({ url }) => {
	const settingsRow = await getOrCreateSettings();
	const rooms = await db.select().from(room).orderBy(room.sortOrder);
	const [arming] = await db.select().from(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));
	const armedAt = arming?.armedAt ? new Date(arming.armedAt).getTime() : null;
	const armedRoomIsFresh = Boolean(
		arming?.roomId && armedAt !== null && Date.now() - armedAt < ARM_WINDOW_MS
	);
	const activeArmedRoom = armedRoomIsFresh
		? (rooms.find((candidate) => candidate.id === arming?.roomId) ?? null)
		: null;

	// Which round to show: an explicit ?round=<id>, or the most recent one.
	const requestedRoundId = url.searchParams.get('round');

	const [targetRound] = requestedRoundId
		? await db.select().from(round).where(eq(round.id, requestedRoundId))
		: await db.select().from(round).orderBy(desc(round.startedAt)).limit(1);

	const readingsForRound = targetRound
		? await db
				.select({
					roomId: reading.roomId,
					roomName: room.name,
					temperatureC: reading.temperatureC,
					humidityPct: reading.humidityPct,
					pm1UgM3: reading.pm1UgM3,
					pm25UgM3: reading.pm25UgM3,
					pm10UgM3: reading.pm10UgM3,
					recordedAt: reading.recordedAt
				})
				.from(reading)
				.leftJoin(room, eq(reading.roomId, room.id))
				.where(eq(reading.roundId, targetRound.id))
				.orderBy(desc(reading.recordedAt))
		: [];

	// One entry per room: its reading this round, or null if not measured yet.
	const roomSnapshots = rooms.map((r) => {
		const roomReading = readingsForRound.find((rd) => rd.roomId === r.id) ?? null;
		return {
			room: r,
			reading: roomReading,
			suggestions: roomReading ? evaluateReading(roomReading) : []
		};
	});

	const pastRounds = await db.select().from(round).orderBy(desc(round.startedAt)).limit(20);

	// Readings that arrived without an active arming (forgot to arm, double
	// press, etc). Surfaced here so they can be tagged after the fact
	// instead of silently vanishing from every page.
	const unassigned = await db
		.select({
			id: reading.id,
			temperatureC: reading.temperatureC,
			humidityPct: reading.humidityPct,
			pm1UgM3: reading.pm1UgM3,
			pm25UgM3: reading.pm25UgM3,
			pm10UgM3: reading.pm10UgM3,
			recordedAt: reading.recordedAt
		})
		.from(reading)
		.where(and(eq(reading.mode, 'spot'), isNull(reading.roomId)))
		.orderBy(desc(reading.recordedAt))
		.limit(20);

	return {
		mode: settingsRow.mode,
		rooms,
		activeArmedRoom,
		targetRound,
		roomSnapshots,
		pastRounds,
		unassigned
	};
};

export const actions: Actions = {
	arm: async ({ request }) => {
		const form = await request.formData();
		const roomId = form.get('roomId');
		if (typeof roomId !== 'string' || !roomId) {
			return fail(400, { error: 'Pick a room first' });
		}

		try {
			const result = await armRoomForSpotCheck(roomId);
			return {
				armed: true,
				armedRoomId: result.room.id,
				armedRoomName: result.room.name
			};
		} catch (e) {
			if (e instanceof ArmError) return fail(e.status, { error: e.message });
			throw e;
		}
	},

	assignRoom: async ({ request }) => {
		const form = await request.formData();
		const readingId = form.get('readingId');
		const roomId = form.get('roomId');

		if (typeof readingId !== 'string' || !readingId) {
			return fail(400, { error: 'Missing reading id' });
		}
		if (typeof roomId !== 'string' || !roomId) {
			return fail(400, { error: 'Pick a room to assign this reading to' });
		}

		await db.update(reading).set({ roomId }).where(eq(reading.id, readingId));

		return { assigned: true };
	}
};
