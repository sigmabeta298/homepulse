import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reading, room, round } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getOrCreateSettings } from '$lib/server/settings';
import { armRoomForSpotCheck, ArmError } from '$lib/server/arm';

export const load: PageServerLoad = async ({ url }) => {
	const settingsRow = await getOrCreateSettings();
	const rooms = await db.select().from(room).orderBy(room.sortOrder);

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
					co2Ppm: reading.co2Ppm,
					pm25UgM3: reading.pm25UgM3,
					recordedAt: reading.recordedAt
				})
				.from(reading)
				.leftJoin(room, eq(reading.roomId, room.id))
				.where(eq(reading.roundId, targetRound.id))
		: [];

	// One entry per room: its reading this round, or null if not measured yet.
	const roomSnapshots = rooms.map((r) => ({
		room: r,
		reading: readingsForRound.find((rd) => rd.roomId === r.id) ?? null
	}));

	const pastRounds = await db.select().from(round).orderBy(desc(round.startedAt)).limit(20);

	return {
		mode: settingsRow.mode,
		rooms,
		targetRound,
		roomSnapshots,
		pastRounds
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
			return { armed: true, armedRoomName: result.room.name };
		} catch (e) {
			if (e instanceof ArmError) return fail(e.status, { error: e.message });
			throw e;
		}
	}
};
