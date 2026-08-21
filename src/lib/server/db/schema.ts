import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// A physical ESP32 node. You only have one now, but this keeps the door
// open for "Living Room", "Bedroom", etc. later without a schema change.
export const device = sqliteTable('device', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(), // e.g. "Living Room"
	slug: text('slug').notNull().unique(), // e.g. "living-room", used as a stable device identifier from the ESP32
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	// Timestamp of the most recent accepted /api/ingest request from this
	// device, used to enforce a minimum gap between requests (see
	// $lib/server/rate-limit.ts). Null until the first reading arrives.
	lastIngestAt: integer('last_ingest_at', { mode: 'timestamp' })
});

// One row per reading pushed from the ESP32.
// All sensor fields are nullable: a single POST might only include
// a subset (e.g. if one sensor on the board fails, the others still land).
export const reading = sqliteTable('reading', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	deviceId: text('device_id')
		.notNull()
		.references(() => device.id),
	// Which room this reading belongs to. Null means "arrived without an
	// armed room in spot mode" — an unassigned reading awaiting manual tagging.
	roomId: text('room_id').references(() => room.id),
	mode: text('mode', { enum: ['spot', 'continuous'] }).notNull(),
	// Only set for spot-check readings, groups them into one walkthrough.
	roundId: text('round_id').references(() => round.id),
	temperatureC: real('temperature_c'),
	humidityPct: real('humidity_pct'),
	pm1UgM3: real('pm1_ug_m3'),
	pm25UgM3: real('pm25_ug_m3'),
	pm10UgM3: real('pm10_ug_m3'),
	recordedAt: integer('recorded_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export type Device = typeof device.$inferSelect;
export type Reading = typeof reading.$inferSelect;
export type NewReading = typeof reading.$inferInsert;

// A room in the house. You manage this list yourself in Settings.
export const room = sqliteTable('room', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(), // e.g. "Kitchen"
	slug: text('slug').notNull().unique(), // e.g. "kitchen"
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export type Room = typeof room.$inferSelect;

// One walkthrough session in spot-check mode. Groups readings taken across
// several rooms within roughly the same window into one comparable snapshot.
export const round = sqliteTable('round', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	// Null while still active. Set when the round auto-closes from inactivity.
	endedAt: integer('ended_at', { mode: 'timestamp' })
});

export type Round = typeof round.$inferSelect;

// Singleton row (id is always "default") holding the current arming state
// for spot-check mode: "the next reading that arrives should be tagged to
// this room." Cleared once a reading consumes it, or once it goes stale.
export const armedRoom = sqliteTable('armed_room', {
	id: text('id').primaryKey().default('default'),
	roomId: text('room_id').references(() => room.id),
	roundId: text('round_id').references(() => round.id),
	armedAt: integer('armed_at', { mode: 'timestamp' })
});

export type ArmedRoom = typeof armedRoom.$inferSelect;

// Singleton row (id is always "default") holding app-wide preferences.
// A real per-user settings table would need a user_id, but this is a
// single-household dashboard, so one row is enough.
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey().default('default'),
	temperatureUnit: text('temperature_unit', { enum: ['C', 'F'] })
		.notNull()
		.default('C'),
	refreshIntervalSeconds: integer('refresh_interval_seconds').notNull().default(60),
	// Which capture mode the whole app is currently in.
	mode: text('mode', { enum: ['spot', 'continuous'] })
		.notNull()
		.default('continuous'),
	// Only meaningful when mode = 'continuous': which room the device is
	// currently parked in.
	continuousRoomId: text('continuous_room_id').references(() => room.id)
});

export type Settings = typeof settings.$inferSelect;

// One row per room per calendar month. This is what raw continuous
// readings get compressed into once a month is fully over - see
// $lib/server/retention.ts. Keeps long-term trend data ("how was May
// 2025 vs May 2026") available forever at near-zero storage cost,
// instead of every 3-minute reading accumulating indefinitely (which
// would eventually blow past Turso's free tier).
//
// Deliberately NOT tied to spot-check readings - those are point-in-time
// snapshots for comparing rooms right now, not a trend to average away.
// Only continuous-mode data ever gets rotated.
export const monthlySummary = sqliteTable(
	'monthly_summary',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		roomId: text('room_id')
			.notNull()
			.references(() => room.id),
		year: integer('year').notNull(),
		month: integer('month').notNull(), // 1-12
		readingCount: integer('reading_count').notNull(),

		avgTemperatureC: real('avg_temperature_c'),
		minTemperatureC: real('min_temperature_c'),
		maxTemperatureC: real('max_temperature_c'),

		avgHumidityPct: real('avg_humidity_pct'),
		minHumidityPct: real('min_humidity_pct'),
		maxHumidityPct: real('max_humidity_pct'),

		avgPm1UgM3: real('avg_pm1_ug_m3'),
		minPm1UgM3: real('min_pm1_ug_m3'),
		maxPm1UgM3: real('max_pm1_ug_m3'),

		avgPm25UgM3: real('avg_pm25_ug_m3'),
		minPm25UgM3: real('min_pm25_ug_m3'),
		maxPm25UgM3: real('max_pm25_ug_m3'),

		avgPm10UgM3: real('avg_pm10_ug_m3'),
		minPm10UgM3: real('min_pm10_ug_m3'),
		maxPm10UgM3: real('max_pm10_ug_m3'),

		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('monthly_summary_room_year_month').on(table.roomId, table.year, table.month)]
);

export type MonthlySummary = typeof monthlySummary.$inferSelect;
