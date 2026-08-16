import { db } from '$lib/server/db';
import { armedRoom } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ARM_WINDOW_MS, SETTINGS_ID } from '$lib/server/settings';
import type { Settings } from '$lib/server/db/schema';

export type RoomResolution = { roomId: string | null; roundId: string | null };

// Decides which room (and, for spot mode, which walkthrough round) an
// incoming reading belongs to, and - for spot mode - consumes the arming
// so a second stray reading doesn't get double-counted for the same room.
//
// Split out from the ingest endpoint so this branching logic (the trickiest
// part of ingest) can be unit tested directly against a real test database,
// without needing to simulate a full SvelteKit request/response cycle.
export async function resolveRoomForReading(
	settingsRow: Pick<Settings, 'mode' | 'continuousRoomId'>
): Promise<RoomResolution> {
	if (settingsRow.mode === 'continuous') {
		return { roomId: settingsRow.continuousRoomId ?? null, roundId: null };
	}

	// spot mode: consume the current arming if it's still fresh.
	const [armed] = await db.select().from(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));

	const isFresh =
		armed?.roomId && armed.armedAt && Date.now() - new Date(armed.armedAt).getTime() < ARM_WINDOW_MS;

	if (!isFresh) {
		return { roomId: null, roundId: null };
	}

	await db
		.update(armedRoom)
		.set({ roomId: null, roundId: null, armedAt: null })
		.where(eq(armedRoom.id, SETTINGS_ID));

	return { roomId: armed.roomId, roundId: armed.roundId };
}
