import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN
});

// PRAGMA statements only work against a local SQLite file connection.
// Turso's remote protocol (Hrana/HTTP) rejects PRAGMA outright with
// SQL_PARSE_ERROR, so this must only run for local file: URLs (dev, and
// the temp DB the test suite uses) - never against a real libsql:// or
// https:// Turso connection.
if (env.DATABASE_URL.startsWith('file:')) {
	await client.execute('PRAGMA busy_timeout = 5000');
}

export const db = drizzle(client, { schema });