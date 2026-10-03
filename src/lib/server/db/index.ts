import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const isVitest = process.env.VITEST === 'true';
const databaseUrl = isVitest ? process.env.HOMEPULSE_TEST_DATABASE_URL : env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		isVitest ? 'Server tests must use HOMEPULSE_TEST_DATABASE_URL' : 'DATABASE_URL is not set'
	);
}

if (isVitest && !databaseUrl.startsWith('file:')) {
	throw new Error('Server tests must use a disposable local SQLite database');
}

// Vercel's filesystem is ephemeral. Refuse to start with a local SQLite
// file there, or rooms/settings/readings can appear to reset between runs.
if (env.VERCEL === '1' && databaseUrl.startsWith('file:')) {
	throw new Error('Vercel deployments must use a persistent Turso DATABASE_URL, not a local file');
}

const client = createClient({
	url: databaseUrl,
	authToken: env.DATABASE_AUTH_TOKEN
});

// PRAGMA statements only work against a local SQLite file connection.
// Turso's remote protocol (Hrana/HTTP) rejects PRAGMA outright with
// SQL_PARSE_ERROR, so this must only run for local file: URLs (dev, and
// the temp DB the test suite uses) - never against a real libsql:// or
// https:// Turso connection.
if (databaseUrl.startsWith('file:')) {
	await client.execute('PRAGMA busy_timeout = 5000');
}

export const db = drizzle(client, { schema });
