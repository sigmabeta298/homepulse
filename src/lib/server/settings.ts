import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const SETTINGS_ID = 'default';

// Allow time to carry the device to the selected room and capture there.
// If the arming expires, the reading stays in its walkthrough round but
// is unassigned so it can be tagged manually rather than misattributed.
export const ARM_WINDOW_MS = 15 * 60 * 1000;

// How long a round can sit idle before it's considered finished and a
// fresh spot-check walkthrough starts a new one.
export const ROUND_INACTIVITY_MS = 30 * 60 * 1000;

export async function getOrCreateSettings() {
	const [existing] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
	if (existing) return existing;

	const [created] = await db.insert(settings).values({ id: SETTINGS_ID }).returning();
	return created;
}
