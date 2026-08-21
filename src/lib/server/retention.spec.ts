import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { room, reading, monthlySummary, armedRoom, settings } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { rotateCompletedMonths } from './retention';

// Other spec files sharing this same temp DB can leave rows behind that
// reference rooms (e.g. an armed_room row from a "leaves a stale arming
// in place" test, or the singleton settings row's continuous_room_id).
// Those are foreign keys into `room`, so they must be cleared before we
// delete rooms here or the delete throws SQLITE_CONSTRAINT_FOREIGNKEY.
beforeEach(async () => {
	await db.delete(monthlySummary);
	await db.delete(reading);
	await db.delete(armedRoom);
	await db.delete(settings);
	await db.delete(room);
});

async function makeRoom(name: string) {
	const [r] = await db
		.insert(room)
		.values({ name, slug: `${name.toLowerCase()}-${Date.now()}-${Math.random()}` })
		.returning();
	return r;
}

async function addReading(roomId: string, recordedAt: Date, values: Partial<typeof reading.$inferInsert> = {}) {
	await db.insert(reading).values({
		deviceId: (await ensureDevice()).id,
		roomId,
		mode: 'continuous',
		recordedAt,
		...values
	});
}

let cachedDeviceId: { id: string } | null = null;
async function ensureDevice() {
	if (cachedDeviceId) return cachedDeviceId;
	const { device } = await import('$lib/server/db/schema');
	const [existing] = await db.select().from(device).where(eq(device.slug, 'test-device'));
	if (existing) {
		cachedDeviceId = existing;
		return existing;
	}
	const [created] = await db.insert(device).values({ name: 'test-device', slug: 'test-device' }).returning();
	cachedDeviceId = created;
	return created;
}

describe('rotateCompletedMonths', () => {
	it('rotates a fully completed past month into a summary row', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		// Three readings across January 2026 (a completed month relative to "now")
		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), {
			temperatureC: 20,
			humidityPct: 40,
			pm25UgM3: 10
		});
		await addReading(office.id, new Date('2026-01-15T10:00:00.000Z'), {
			temperatureC: 24,
			humidityPct: 50,
			pm25UgM3: 20
		});
		await addReading(office.id, new Date('2026-01-25T10:00:00.000Z'), {
			temperatureC: 28,
			humidityPct: 60,
			pm25UgM3: 30
		});

		const result = await rotateCompletedMonths(now);
		expect(result).toEqual({ roomMonthsRotated: 1, readingsCompressed: 3 });

		const [summary] = await db
			.select()
			.from(monthlySummary)
			.where(and(eq(monthlySummary.roomId, office.id), eq(monthlySummary.year, 2026), eq(monthlySummary.month, 1)));

		expect(summary.readingCount).toBe(3);
		expect(summary.avgTemperatureC).toBe(24); // (20+24+28)/3
		expect(summary.minTemperatureC).toBe(20);
		expect(summary.maxTemperatureC).toBe(28);
		expect(summary.avgHumidityPct).toBe(50);
		expect(summary.avgPm25UgM3).toBe(20);
		expect(summary.minPm25UgM3).toBe(10);
		expect(summary.maxPm25UgM3).toBe(30);
	});

	it('deletes the raw readings after successfully summarizing them', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), { temperatureC: 22 });

		await rotateCompletedMonths(now);

		const remaining = await db.select().from(reading).where(eq(reading.roomId, office.id));
		expect(remaining).toHaveLength(0);
	});

	it('never touches the current, still-in-progress month', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		// This reading is in March 2026 - the same month as "now" - so it
		// should NOT be rotated even though it's in the past relative to
		// the 15th.
		await addReading(office.id, new Date('2026-03-01T10:00:00.000Z'), { temperatureC: 22 });

		const result = await rotateCompletedMonths(now);
		expect(result).toEqual({ roomMonthsRotated: 0, readingsCompressed: 0 });

		const remaining = await db.select().from(reading).where(eq(reading.roomId, office.id));
		expect(remaining).toHaveLength(1);

		const summaries = await db.select().from(monthlySummary);
		expect(summaries).toHaveLength(0);
	});

	it('produces separate summary rows per room, not merged together', async () => {
		const office = await makeRoom('Office');
		const kitchen = await makeRoom('Kitchen');
		const now = new Date('2026-03-15T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-10T10:00:00.000Z'), { temperatureC: 20 });
		await addReading(kitchen.id, new Date('2026-01-10T10:00:00.000Z'), { temperatureC: 30 });

		await rotateCompletedMonths(now);

		const summaries = await db.select().from(monthlySummary);
		expect(summaries).toHaveLength(2);

		const officeSum = summaries.find((s) => s.roomId === office.id);
		const kitchenSum = summaries.find((s) => s.roomId === kitchen.id);
		expect(officeSum?.avgTemperatureC).toBe(20);
		expect(kitchenSum?.avgTemperatureC).toBe(30);
	});

	it('handles multiple completed months in one run', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-04-01T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-10T10:00:00.000Z'), { temperatureC: 20 });
		await addReading(office.id, new Date('2026-02-10T10:00:00.000Z'), { temperatureC: 22 });
		await addReading(office.id, new Date('2026-03-10T10:00:00.000Z'), { temperatureC: 24 });

		const result = await rotateCompletedMonths(now);
		expect(result.roomMonthsRotated).toBe(3);

		const summaries = await db.select().from(monthlySummary).where(eq(monthlySummary.roomId, office.id));
		expect(summaries).toHaveLength(3);
		expect(summaries.map((s) => s.month).sort()).toEqual([1, 2, 3]);
	});

	it('is idempotent - running twice does not duplicate or corrupt summaries', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), { temperatureC: 20 });
		await addReading(office.id, new Date('2026-01-15T10:00:00.000Z'), { temperatureC: 24 });

		await rotateCompletedMonths(now);
		const secondRun = await rotateCompletedMonths(now); // nothing left to rotate

		expect(secondRun).toEqual({ roomMonthsRotated: 0, readingsCompressed: 0 });

		const summaries = await db.select().from(monthlySummary);
		expect(summaries).toHaveLength(1); // still just one row, not duplicated
		expect(summaries[0].avgTemperatureC).toBe(22);
	});

	it('ignores spot-check readings entirely, even from past months', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), {
			mode: 'spot',
			temperatureC: 99
		});

		const result = await rotateCompletedMonths(now);
		expect(result).toEqual({ roomMonthsRotated: 0, readingsCompressed: 0 });

		const remaining = await db.select().from(reading).where(eq(reading.roomId, office.id));
		expect(remaining).toHaveLength(1); // untouched
	});

	it('handles a null sensor field correctly (never averages in a phantom zero)', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		// pm25 present on one reading, missing on the other
		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), {
			temperatureC: 20,
			pm25UgM3: null
		});
		await addReading(office.id, new Date('2026-01-15T10:00:00.000Z'), {
			temperatureC: 24,
			pm25UgM3: 20
		});

		await rotateCompletedMonths(now);

		const [summary] = await db.select().from(monthlySummary).where(eq(monthlySummary.roomId, office.id));
		// pm25 average should be 20 (just the one real value), not 10
		// (which is what you'd get if the null were silently treated as 0)
		expect(summary.avgPm25UgM3).toBe(20);
	});

	it('returns an all-null summary for a field that never had any data', async () => {
		const office = await makeRoom('Office');
		const now = new Date('2026-03-15T00:00:00.000Z');

		await addReading(office.id, new Date('2026-01-05T10:00:00.000Z'), {
			temperatureC: 20,
			pm1UgM3: null,
			pm25UgM3: null,
			pm10UgM3: null
		});

		await rotateCompletedMonths(now);

		const [summary] = await db.select().from(monthlySummary).where(eq(monthlySummary.roomId, office.id));
		expect(summary.avgPm1UgM3).toBeNull();
		expect(summary.minPm1UgM3).toBeNull();
		expect(summary.maxPm1UgM3).toBeNull();
	});
});
