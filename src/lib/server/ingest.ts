import { db } from '$lib/server/db';
import { armedRoom } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { ARM_WINDOW_MS, SETTINGS_ID } from '$lib/server/settings';
import type { CaptureRequest, Settings } from '$lib/server/db/schema';

export type RoomResolution = { roomId: string | null; roundId: string | null };

export async function resolveRoomForCaptureRequest(
	request: Pick<CaptureRequest, 'mode' | 'roomId' | 'roundId' | 'armToken'>
): Promise<RoomResolution> {
	if (request.mode === 'continuous') {
		return { roomId: request.roomId, roundId: null };
	}

	if (!request.roomId || !request.roundId || !request.armToken) {
		throw new Error('Spot capture request is missing its room or walkthrough association.');
	}

	await db
		.update(armedRoom)
		.set({ roomId: null, roundId: null, armToken: null, armedAt: null })
		.where(
			and(
				eq(armedRoom.id, SETTINGS_ID),
				eq(armedRoom.roomId, request.roomId),
				eq(armedRoom.roundId, request.roundId),
				eq(armedRoom.armToken, request.armToken)
			)
		);

	return { roomId: request.roomId, roundId: request.roundId };
}

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
		armed?.roomId &&
		armed.armedAt &&
		Date.now() - new Date(armed.armedAt).getTime() < ARM_WINDOW_MS;

	if (!isFresh) {
		return { roomId: null, roundId: armed?.roundId ?? null };
	}

	await db
		.update(armedRoom)
		.set({ roomId: null, roundId: null, armToken: null, armedAt: null })
		.where(eq(armedRoom.id, SETTINGS_ID));

	return { roomId: armed.roomId, roundId: armed.roundId };
}
