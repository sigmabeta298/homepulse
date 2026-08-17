import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// DATABASE_AUTH_TOKEN is only needed when DATABASE_URL points at a remote
// Turso database (libsql://...). Local file: URLs used in dev don't need it.
const client = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN
});

// Without this, any two operations that happen to touch the file at the
// same instant throw SQLITE_BUSY immediately instead of one simply
// waiting for the other. This matters most for local file: databases
// (dev, and the temp DB the test suite uses) - Windows' stricter file
// locking makes this collision far more likely there than on Linux/Mac,
// but the pragma is harmless (and still useful) everywhere.
await client.execute('PRAGMA busy_timeout = 5000');

export const db = drizzle(client, { schema });
