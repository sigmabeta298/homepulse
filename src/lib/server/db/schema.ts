import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
		.$defaultFn(() => new Date())
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
	temperatureC: real('temperature_c'),
	humidityPct: real('humidity_pct'),
	co2Ppm: real('co2_ppm'),
	pm25UgM3: real('pm25_ug_m3'),
	recordedAt: integer('recorded_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export type Device = typeof device.$inferSelect;
export type Reading = typeof reading.$inferSelect;
export type NewReading = typeof reading.$inferInsert;

// Singleton row (id is always "default") holding app-wide preferences.
// A real per-user settings table would need a user_id, but this is a
// single-household dashboard, so one row is enough.
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey().default('default'),
	temperatureUnit: text('temperature_unit', { enum: ['C', 'F'] })
		.notNull()
		.default('C'),
	refreshIntervalSeconds: integer('refresh_interval_seconds').notNull().default(60),
	aqiThreshold: real('aqi_threshold').notNull().default(35),
	tempHighThresholdC: real('temp_high_threshold_c').notNull().default(28)
});

export type Settings = typeof settings.$inferSelect;
