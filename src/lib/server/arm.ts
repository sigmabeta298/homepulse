import { db } from '$lib/server/db';
import { armedRoom, room, round, type Round } from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
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
	const [targetRoom] = await db.select().from(room).where(eq(room.id, roomId));
	if (!targetRoom) throw new ArmError(404, 'Room not found');

	let activeRound: Round | undefined = (
		await db.select().from(round).where(isNull(round.endedAt))
	)[0];

	if (activeRound && Date.now() - new Date(activeRound.startedAt).getTime() > ROUND_INACTIVITY_MS) {
		await db.update(round).set({ endedAt: new Date() }).where(eq(round.id, activeRound.id));
		activeRound = undefined;
	}

	if (!activeRound) {
		[activeRound] = await db.insert(round).values({}).returning();
	}

	await db
		.insert(armedRoom)
		.values({
			id: SETTINGS_ID,
			roomId: targetRoom.id,
			roundId: activeRound.id,
			armedAt: new Date()
		})
		.onConflictDoUpdate({
			target: armedRoom.id,
			set: { roomId: targetRoom.id, roundId: activeRound.id, armedAt: new Date() }
		});

	return { room: targetRoom, roundId: activeRound.id };
}
