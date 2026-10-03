import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { room, round, armedRoom, settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveRoomForReading } from './ingest';
import { ARM_WINDOW_MS, SETTINGS_ID } from './settings';

// Clears the singleton/shared tables before each test so tests don't leak
// state into each other. Devices/readings aren't touched since this file
// doesn't need them, and room/round rows get fresh ids per test anyway.
beforeEach(async () => {
	await db.delete(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));
	await db.delete(settings).where(eq(settings.id, SETTINGS_ID));
});

async function makeRoom(name: string) {
	const [r] = await db
		.insert(room)
		.values({ name, slug: `${name.toLowerCase()}-${Date.now()}-${Math.random()}` })
		.returning();
	return r;
}

describe('resolveRoomForReading - continuous mode', () => {
	it('returns the configured continuousRoomId', async () => {
		const kitchen = await makeRoom('Kitchen');

		const result = await resolveRoomForReading({
			mode: 'continuous',
			continuousRoomId: kitchen.id
		});

		expect(result).toEqual({ roomId: kitchen.id, roundId: null });
	});

	it('returns null roomId when no room is parked in yet', async () => {
		const result = await resolveRoomForReading({ mode: 'continuous', continuousRoomId: null });
		expect(result).toEqual({ roomId: null, roundId: null });
	});
});

describe('resolveRoomForReading - spot mode', () => {
	it('returns null when nothing has been armed', async () => {
		const result = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });
		expect(result).toEqual({ roomId: null, roundId: null });
	});

	it('returns the armed room and consumes the arming (one-time use)', async () => {
		const office = await makeRoom('Office');
		const [activeRound] = await db.insert(round).values({}).returning();

		await db.insert(armedRoom).values({
			id: SETTINGS_ID,
			roomId: office.id,
			roundId: activeRound.id,
			armedAt: new Date()
		});

		const first = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });
		expect(first).toEqual({ roomId: office.id, roundId: activeRound.id });

		// A second reading arriving without re-arming should NOT also land
		// on Office - the arming is single-use, exactly so a stray double
		// reading doesn't silently get mislabeled into the wrong room.
		const second = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });
		expect(second).toEqual({ roomId: null, roundId: null });
	});

	it('treats an arming older than ARM_WINDOW_MS as stale and returns null', async () => {
		const bedroom = await makeRoom('Bedroom');
		const [activeRound] = await db.insert(round).values({}).returning();

		const staleTimestamp = new Date(Date.now() - ARM_WINDOW_MS - 1000);
		await db.insert(armedRoom).values({
			id: SETTINGS_ID,
			roomId: bedroom.id,
			roundId: activeRound.id,
			armedAt: staleTimestamp
		});

		const result = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });
		expect(result).toEqual({ roomId: null, roundId: activeRound.id });
	});

	it('accepts a room arming after a several-minute walk between rooms', async () => {
		const bedroom = await makeRoom('Bedroom');
		const [activeRound] = await db.insert(round).values({}).returning();
		const armedAt = new Date(Date.now() - 5 * 60 * 1000);

		await db.insert(armedRoom).values({
			id: SETTINGS_ID,
			roomId: bedroom.id,
			roundId: activeRound.id,
			armedAt
		});

		const result = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });
		expect(result).toEqual({ roomId: bedroom.id, roundId: activeRound.id });
	});

	it('leaves a stale arming in place but does not assign its room', async () => {
		const bedroom = await makeRoom('Bedroom');
		const [activeRound] = await db.insert(round).values({}).returning();
		const staleTimestamp = new Date(Date.now() - ARM_WINDOW_MS - 1000);

		await db.insert(armedRoom).values({
			id: SETTINGS_ID,
			roomId: bedroom.id,
			roundId: activeRound.id,
			armedAt: staleTimestamp
		});

		const result = await resolveRoomForReading({ mode: 'spot', continuousRoomId: null });

		const [row] = await db.select().from(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));
		// The room is not guessed after expiry. Keeping the arming row also
		// keeps the reading associated with the walkthrough for later manual
		// assignment.
		expect(row.roomId).toBe(bedroom.id);
		expect(result).toEqual({ roomId: null, roundId: activeRound.id });
	});
});
