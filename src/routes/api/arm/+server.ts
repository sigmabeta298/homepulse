import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOrCreateSettings } from '$lib/server/settings';
import { armRoomForSpotCheck, ArmError } from '$lib/server/arm';

// POST /api/arm  { roomId: string }
// Called right before you walk to a room in spot-check mode. Opens a new
// round if none is currently active, then marks this room as "the next
// reading belongs here." Kept as its own JSON endpoint (in addition to the
// Compare page's form action) in case you ever want to arm from something
// other than the web app — e.g. a phone shortcut/widget.
export const POST: RequestHandler = async ({ request }) => {
	const settingsRow = await getOrCreateSettings();
	if (settingsRow.mode !== 'spot') {
		throw error(400, 'Arming only applies in spot-check mode. Switch modes in Settings first.');
	}

	const body = await request.json().catch(() => null);
	const roomId = body && typeof body.roomId === 'string' ? body.roomId : null;
	if (!roomId) throw error(400, 'roomId is required');

	try {
		const result = await armRoomForSpotCheck(roomId);
		return json({ ok: true, armedRoom: result.room.name, roundId: result.roundId });
	} catch (e) {
		if (e instanceof ArmError) throw error(e.status, e.message);
		throw e;
	}
};
