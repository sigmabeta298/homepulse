import { db } from '$lib/server/db';
import { reading, monthlySummary } from '$lib/server/db/schema';
import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';

type RawReading = {
	id: string;
	roomId: string | null;
	temperatureC: number | null;
	humidityPct: number | null;
	pm1UgM3: number | null;
	pm25UgM3: number | null;
	pm10UgM3: number | null;
	recordedAt: Date;
};

type FieldStats = { avg: number | null; min: number | null; max: number | null };

// Averages/min/max a single field across a bucket of readings, correctly
// ignoring nulls (a sensor that was flaky for part of the month shouldn't
// drag the average toward zero) and returning all-null if the field was
// never present at all, rather than a misleading 0.
function aggregateField(values: (number | null)[]): FieldStats {
	const present = values.filter((v): v is number => v !== null);
	if (present.length === 0) return { avg: null, min: null, max: null };

	const sum = present.reduce((a, b) => a + b, 0);
	return {
		avg: sum / present.length,
		min: Math.min(...present),
		max: Math.max(...present)
	};
}

export type RotationResult = {
	roomMonthsRotated: number;
	readingsCompressed: number;
};

// Compresses every fully-completed month of continuous-mode readings into
// one summary row per room per month, then deletes the raw readings that
// went into it. The current, still-in-progress month is never touched -
// only whole months strictly before the one `now` falls in.
//
// Idempotent and safe to run repeatedly (e.g. daily via cron): a month
// that's already been rotated simply won't have any raw readings left to
// find, so re-running costs a fast, empty query and does nothing further.
// If a previous run was interrupted after writing the summary but before
// deleting the raw rows, re-running recomputes and upserts the same
// summary (harmless) and retries the delete.
//
// Spot-check readings are deliberately never touched here - they're
// point-in-time snapshots for comparing rooms, not a trend to average
// away, and there are far fewer of them anyway.
export async function rotateCompletedMonths(now: Date = new Date()): Promise<RotationResult> {
	const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

	const oldReadings: RawReading[] = await db
		.select({
			id: reading.id,
			roomId: reading.roomId,
			temperatureC: reading.temperatureC,
			humidityPct: reading.humidityPct,
			pm1UgM3: reading.pm1UgM3,
			pm25UgM3: reading.pm25UgM3,
			pm10UgM3: reading.pm10UgM3,
			recordedAt: reading.recordedAt
		})
		.from(reading)
		.where(
			and(
				eq(reading.mode, 'continuous'),
				isNotNull(reading.roomId),
				lt(reading.recordedAt, currentMonthStart)
			)
		);

	// Group into (room, year, month) buckets in JS rather than via SQL date
	// functions - drizzle already hands back real JS Date objects here
	// regardless of how timestamps are stored on disk, so this sidesteps
	// any ambiguity about SQLite's on-disk timestamp representation.
	const buckets = new Map<string, { roomId: string; year: number; month: number; rows: RawReading[] }>();

	for (const r of oldReadings) {
		if (!r.roomId) continue; // isNotNull above should guarantee this, but keeps TS happy
		const year = r.recordedAt.getUTCFullYear();
		const month = r.recordedAt.getUTCMonth() + 1; // JS months are 0-indexed; ours are 1-12
		const key = `${r.roomId}|${year}|${month}`;

		if (!buckets.has(key)) buckets.set(key, { roomId: r.roomId, year, month, rows: [] });
		buckets.get(key)!.rows.push(r);
	}

	let roomMonthsRotated = 0;
	let readingsCompressed = 0;

	for (const bucket of buckets.values()) {
		const temperature = aggregateField(bucket.rows.map((r) => r.temperatureC));
		const humidity = aggregateField(bucket.rows.map((r) => r.humidityPct));
		const pm1 = aggregateField(bucket.rows.map((r) => r.pm1UgM3));
		const pm25 = aggregateField(bucket.rows.map((r) => r.pm25UgM3));
		const pm10 = aggregateField(bucket.rows.map((r) => r.pm10UgM3));

		const summaryValues = {
			roomId: bucket.roomId,
			year: bucket.year,
			month: bucket.month,
			readingCount: bucket.rows.length,
			avgTemperatureC: temperature.avg,
			minTemperatureC: temperature.min,
			maxTemperatureC: temperature.max,
			avgHumidityPct: humidity.avg,
			minHumidityPct: humidity.min,
			maxHumidityPct: humidity.max,
			avgPm1UgM3: pm1.avg,
			minPm1UgM3: pm1.min,
			maxPm1UgM3: pm1.max,
			avgPm25UgM3: pm25.avg,
			minPm25UgM3: pm25.min,
			maxPm25UgM3: pm25.max,
			avgPm10UgM3: pm10.avg,
			minPm10UgM3: pm10.min,
			maxPm10UgM3: pm10.max
		};

		await db
			.insert(monthlySummary)
			.values(summaryValues)
			.onConflictDoUpdate({
				target: [monthlySummary.roomId, monthlySummary.year, monthlySummary.month],
				set: summaryValues
			});

		const idsToDelete = bucket.rows.map((r) => r.id);
		await db.delete(reading).where(inArray(reading.id, idsToDelete));

		roomMonthsRotated += 1;
		readingsCompressed += bucket.rows.length;
	}

	return { roomMonthsRotated, readingsCompressed };
}
