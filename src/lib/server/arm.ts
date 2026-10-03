import { db } from '$lib/server/db';
import { armedRoom, reading, room, round, type Round } from '$lib/server/db/schema';
import { and, desc, eq, inArray, isNull, max, ne } from 'drizzle-orm';
import { ROUND_INACTIVITY_MS, SETTINGS_ID } from '$lib/server/settings';

export class ArmError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

// Arms a room for spot-check capture: opens a new round if none is active
// (or the active one has gone stale), and marks the given room as "the
// next reading that arrives belongs here."
export async function armRoomForSpotCheck(roomId: string) {
	return db.transaction(async (tx) => {
		const [targetRoom] = await tx.select().from(room).where(eq(room.id, roomId));
		if (!targetRoom) throw new ArmError(404, 'Room not found');

		const now = new Date();
		const openRounds = await tx
			.select()
			.from(round)
			.where(isNull(round.endedAt))
			.orderBy(desc(round.startedAt));
		const [arming] =
			openRounds.length > 0
				? await tx
						.select({ roundId: armedRoom.roundId, armedAt: armedRoom.armedAt })
						.from(armedRoom)
						.where(eq(armedRoom.id, SETTINGS_ID))
				: [];
		const readingActivity =
			openRounds.length > 0
				? await tx
						.select({ roundId: reading.roundId, lastReadingAt: max(reading.recordedAt) })
						.from(reading)
						.where(
							inArray(
								reading.roundId,
								openRounds.map((candidate) => candidate.id)
							)
						)
						.groupBy(reading.roundId)
				: [];
		const lastReadingByRound = new Map(
			readingActivity.map(({ roundId, lastReadingAt }) => [roundId, lastReadingAt])
		);
		const lastActivityAt = (candidate: Round) => {
			const timestamps = [candidate.startedAt];
			if (arming?.roundId === candidate.id && arming.armedAt) {
				timestamps.push(arming.armedAt);
			}
			const lastReadingAt = lastReadingByRound.get(candidate.id);
			if (lastReadingAt) timestamps.push(lastReadingAt);
			return Math.max(...timestamps.map((timestamp) => new Date(timestamp).getTime()));
		};
		const recentOpenRounds = openRounds.filter(
			(candidate) => now.getTime() - lastActivityAt(candidate) <= ROUND_INACTIVITY_MS
		);
		const activeRound = recentOpenRounds[0];

		if (activeRound) {
			const duplicateRoundIds = recentOpenRounds.slice(1).map((candidate) => candidate.id);
			if (duplicateRoundIds.length > 0) {
				await tx
					.update(reading)
					.set({ roundId: activeRound.id })
					.where(inArray(reading.roundId, duplicateRoundIds));
			}
			await tx
				.update(round)
				.set({ endedAt: now })
				.where(and(isNull(round.endedAt), ne(round.id, activeRound.id)));
		} else if (openRounds.length > 0) {
			await tx.update(round).set({ endedAt: now }).where(isNull(round.endedAt));
		}

		let targetRound: Round;
		if (activeRound) {
			targetRound = activeRound;
		} else {
			[targetRound] = await tx.insert(round).values({}).returning();
		}

		const armToken = crypto.randomUUID();
		await tx
			.insert(armedRoom)
			.values({
				id: SETTINGS_ID,
				roomId: targetRoom.id,
				roundId: targetRound.id,
				armToken,
				armedAt: now
			})
			.onConflictDoUpdate({
				target: armedRoom.id,
				set: { roomId: targetRoom.id, roundId: targetRound.id, armToken, armedAt: now }
			});

		return { room: targetRoom, roundId: targetRound.id };
	});
}
