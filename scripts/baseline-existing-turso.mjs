import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (!authToken) throw new Error('DATABASE_AUTH_TOKEN is not set');

const parsedUrl = new URL(databaseUrl);
const databaseHost = parsedUrl.hostname || 'local';
const confirmation = process.argv.find((arg) => arg.startsWith('--confirm-host='))?.slice(15);

if (confirmation !== databaseHost) {
	throw new Error(
		`Refusing to write. Re-run with --confirm-host=${databaseHost} after verifying this is the intended database.`
	);
}

const expectedTags = [
	'0000_lush_absorbing_man',
	'0001_graceful_joseph',
	'0002_fat_terrax',
	'0003_concerned_black_bolt'
];

const expectedColumns = {
	armed_room: ['id', 'room_id', 'round_id', 'armed_at'],
	device: ['id', 'name', 'slug', 'created_at', 'last_ingest_at'],
	monthly_summary: [
		'id',
		'room_id',
		'year',
		'month',
		'reading_count',
		'avg_temperature_c',
		'min_temperature_c',
		'max_temperature_c',
		'avg_humidity_pct',
		'min_humidity_pct',
		'max_humidity_pct',
		'avg_pm1_ug_m3',
		'min_pm1_ug_m3',
		'max_pm1_ug_m3',
		'avg_pm25_ug_m3',
		'min_pm25_ug_m3',
		'max_pm25_ug_m3',
		'avg_pm10_ug_m3',
		'min_pm10_ug_m3',
		'max_pm10_ug_m3',
		'created_at'
	],
	reading: [
		'id',
		'device_id',
		'room_id',
		'mode',
		'round_id',
		'temperature_c',
		'humidity_pct',
		'pm1_ug_m3',
		'pm25_ug_m3',
		'pm10_ug_m3',
		'recorded_at',
		'capture_request_id'
	],
	room: ['id', 'name', 'slug', 'sort_order', 'created_at'],
	round: ['id', 'started_at', 'ended_at'],
	settings: ['id', 'temperature_unit', 'refresh_interval_seconds', 'mode', 'continuous_room_id'],
	push_subscription: ['endpoint', 'user_email', 'p256dh', 'auth', 'created_at'],
	capture_request: ['id', 'request_id', 'requested_at', 'completed_at']
};

const expectedIndexes = {
	device: ['device_slug_unique'],
	monthly_summary: ['monthly_summary_room_year_month'],
	reading: ['reading_capture_request_id_unique'],
	room: ['room_slug_unique'],
	push_subscription: ['push_subscription_user_email']
};

const expectedTargetStatements = [
	'ALTER TABLE `armed_room` ADD `arm_token` text;',
	"ALTER TABLE `capture_request` ADD `mode` text DEFAULT 'continuous' NOT NULL;",
	'ALTER TABLE `capture_request` ADD `room_id` text REFERENCES room(id);',
	'ALTER TABLE `capture_request` ADD `round_id` text REFERENCES round(id);',
	'ALTER TABLE `capture_request` ADD `arm_token` text;'
];

async function readMigration(tag) {
	const sql = await readFile(resolve(root, 'drizzle', `${tag}.sql`), 'utf8');
	return {
		hash: createHash('sha256').update(sql).digest('hex'),
		statements: sql
			.split('--> statement-breakpoint')
			.map((statement) => statement.trim())
			.filter(Boolean)
	};
}

async function assertExpectedSchema(transaction) {
	for (const [table, expected] of Object.entries(expectedColumns)) {
		const tableResult = await transaction.execute({
			sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
			args: [table]
		});
		if (!tableResult.rows.length) {
			throw new Error(`Expected existing table "${table}" was not found; no changes were made.`);
		}

		const columns = await transaction.execute(`PRAGMA table_info("${table}")`);
		const actualNames = columns.rows.map((row) => String(row.name)).sort();
		const expectedNames = [...expected].sort();
		if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
			throw new Error(
				`Table "${table}" does not match the expected pre-0003 schema; no changes were made.`
			);
		}
	}

	for (const [table, expected] of Object.entries(expectedIndexes)) {
		const indexes = await transaction.execute(`PRAGMA index_list("${table}")`);
		const actualNames = new Set(indexes.rows.map((row) => String(row.name)));
		const missing = expected.filter((name) => !actualNames.has(name));
		if (missing.length) {
			throw new Error(
				`Table "${table}" is missing expected index(es): ${missing.join(', ')}; no changes were made.`
			);
		}
	}
}

const journal = JSON.parse(await readFile(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'));
const entries = journal.entries;

if (
	entries.length !== expectedTags.length ||
	entries.some((entry, index) => entry.idx !== index || entry.tag !== expectedTags[index])
) {
	throw new Error('The Drizzle migration journal differs from the expected 0000–0003 sequence.');
}

const migrations = await Promise.all(expectedTags.map(readMigration));
if (JSON.stringify(migrations[3].statements) !== JSON.stringify(expectedTargetStatements)) {
	throw new Error('Migration 0003 differs from the expected additive schema changes.');
}

const client = createClient({ url: databaseUrl, authToken });
let transaction;

try {
	transaction = await client.transaction('write');
	await transaction.execute(`
		CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)
	`);

	const appliedMigrations = await transaction.execute(
		'SELECT id, hash, created_at FROM "__drizzle_migrations"'
	);
	if (appliedMigrations.rows.length) {
		throw new Error(
			'The migration history is not empty; this one-time baseline is only for an untracked existing schema. No changes were made.'
		);
	}

	await assertExpectedSchema(transaction);

	for (let index = 0; index < 3; index += 1) {
		await transaction.execute({
			sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
			args: [migrations[index].hash, entries[index].when]
		});
	}

	for (const statement of migrations[3].statements) {
		await transaction.execute(statement);
	}

	await transaction.execute({
		sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
		args: [migrations[3].hash, entries[3].when]
	});

	await transaction.commit();
	transaction = undefined;

	console.log(
		`Baseline recorded and migration 0003 applied to "${databaseHost}". Existing application data was not modified.`
	);
} catch (error) {
	if (transaction) {
		try {
			await transaction.rollback();
		} catch (rollbackError) {
			console.error('Rollback also failed:', rollbackError);
		}
	}
	throw error;
} finally {
	await client.close();
}
