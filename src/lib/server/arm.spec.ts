import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { device, reading, room, round, armedRoom } from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { armRoomForSpotCheck, ArmError } from './arm';

beforeEach(async () => {
	// Wipe rounds/armedRoom between tests so "is there an active round"
	// checks in each test start from a clean slate.
	await db.delete(reading);
	await db.delete(armedRoom);
	await db.delete(round);
});

async function makeRoom(name: string) {
	const [r] = await db
		.insert(room)
		.values({ name, slug: `${name.toLowerCase()}-${Date.now()}-${Math.random()}` })
		.returning();
	return r;
}

describe('armRoomForSpotCheck', () => {
	it('throws ArmError for a room that does not exist', async () => {
		await expect(armRoomForSpotCheck('nonexistent-id')).rejects.toThrow(ArmError);
	});

	it('opens a new round when none is currently active', async () => {
		const kitchen = await makeRoom('Kitchen');

		const result = await armRoomForSpotCheck(kitchen.id);

		expect(result.room.id).toBe(kitchen.id);
		expect(result.roundId).toBeTruthy();

		const activeRounds = await db.select().from(round).where(isNull(round.endedAt));
		expect(activeRounds).toHaveLength(1);
		expect(activeRounds[0].id).toBe(result.roundId);
	});

	it('reuses the active round when arming a second room in the same walkthrough', async () => {
		const kitchen = await makeRoom('Kitchen');
		const office = await makeRoom('Office');

		const first = await armRoomForSpotCheck(kitchen.id);
		const second = await armRoomForSpotCheck(office.id);

		// Same round both times - this is what makes the two readings
		// comparable as one walkthrough on the Compare page.
		expect(second.roundId).toBe(first.roundId);

		const activeRounds = await db.select().from(round).where(isNull(round.endedAt));
		expect(activeRounds).toHaveLength(1);
	});

	it('overwrites the armed room each time (arming Office after Kitchen clears Kitchen)', async () => {
		const kitchen = await makeRoom('Kitchen');
		const office = await makeRoom('Office');

		await armRoomForSpotCheck(kitchen.id);
		await armRoomForSpotCheck(office.id);

		const [armed] = await db.select().from(armedRoom);
		expect(armed.roomId).toBe(office.id);
	});

	it('starts a fresh round if the active one has gone stale from inactivity', async () => {
		const kitchen = await makeRoom('Kitchen');

		// Manually insert an "active" round that started long enough ago to
		// count as abandoned, rather than waiting real time.
		const staleStartedAt = new Date(Date.now() - 31 * 60 * 1000); // 31 min ago
		const [staleRound] = await db.insert(round).values({ startedAt: staleStartedAt }).returning();

		const result = await armRoomForSpotCheck(kitchen.id);

		expect(result.roundId).not.toBe(staleRound.id);

		// The stale round should now be closed out (endedAt set), and only
		// the new round should be active.
		const activeRounds = await db.select().from(round).where(isNull(round.endedAt));
		expect(activeRounds).toHaveLength(1);
		expect(activeRounds[0].id).toBe(result.roundId);
	});

	it('keeps a round active when it has a recent reading even if it started earlier', async () => {
		const kitchen = await makeRoom('Kitchen');
		const staleStartedAt = new Date(Date.now() - 31 * 60 * 1000);
		const [activeRound] = await db.insert(round).values({ startedAt: staleStartedAt }).returning();
		const [testDevice] = await db
			.insert(device)
			.values({ name: 'test-device', slug: `test-device-${crypto.randomUUID()}` })
			.returning();
		await db.insert(reading).values({
			deviceId: testDevice.id,
			roomId: kitchen.id,
			roundId: activeRound.id,
			mode: 'spot',
			recordedAt: new Date(Date.now() - 60 * 1000)
		});

		const result = await armRoomForSpotCheck(kitchen.id);

		expect(result.roundId).toBe(activeRound.id);
		const activeRounds = await db.select().from(round).where(isNull(round.endedAt));
		expect(activeRounds).toHaveLength(1);
	});

	it('reuses the newest recent round and closes other open rounds', async () => {
		const kitchen = await makeRoom('Kitchen');
		const olderStartedAt = new Date(Date.now() - 5 * 60 * 1000);
		const newerStartedAt = new Date(Date.now() - 2 * 60 * 1000);
		const [olderRound] = await db.insert(round).values({ startedAt: olderStartedAt }).returning();
		const [newerRound] = await db.insert(round).values({ startedAt: newerStartedAt }).returning();
		const [testDevice] = await db
			.insert(device)
			.values({ name: 'test-device', slug: `test-device-${crypto.randomUUID()}` })
			.returning();
		await db.insert(reading).values({
			deviceId: testDevice.id,
			roomId: kitchen.id,
			roundId: olderRound.id,
			mode: 'spot'
		});

		const result = await armRoomForSpotCheck(kitchen.id);

		expect(result.roundId).toBe(newerRound.id);
		const openRounds = await db.select().from(round).where(isNull(round.endedAt));
		expect(openRounds).toHaveLength(1);
		expect(openRounds[0].id).toBe(newerRound.id);
		const [closedOlderRound] = await db.select().from(round).where(eq(round.id, olderRound.id));
		expect(closedOlderRound.endedAt).toBeTruthy();
		const [mergedReading] = await db.select().from(reading);
		expect(mergedReading.roundId).toBe(newerRound.id);
	});
});
