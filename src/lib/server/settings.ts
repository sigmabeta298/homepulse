import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const SETTINGS_ID = 'default';

// How long an armed room stays valid before it's considered stale.
// If you arm a room but don't press the capture button within this
// window, the arming is ignored and the reading falls back to unassigned.
export const ARM_WINDOW_MS = 2 * 60 * 1000;

// How long a round can sit idle before it's considered finished and a
// fresh spot-check walkthrough starts a new one.
export const ROUND_INACTIVITY_MS = 30 * 60 * 1000;

export async function getOrCreateSettings() {
	const [existing] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
	if (existing) return existing;

	const [created] = await db.insert(settings).values({ id: SETTINGS_ID }).returning();
	return created;
}
