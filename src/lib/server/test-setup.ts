import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Server-side tests (anything touching $lib/server/db) run against a real,
// disposable SQLite database rather than a mock. The logic we most want to
// test here - mode branching, arming consumption, rate limiting - is
// mostly database reads/writes, so mocking the DB would mean re-implementing
// (and re-trusting) that logic in the mock. A real temp DB, pushed with the
// actual schema, tests the real thing.

const tmpDir = mkdtempSync(path.join(tmpdir(), 'homepulse-test-'));
const dbPath = path.join(tmpDir, 'test.db');
const dbUrl = `file:${dbPath}`;

process.env.DATABASE_URL = dbUrl;
process.env.INGEST_API_KEY = 'test-key';

if (!existsSync(dbPath)) {
	// Pushes the real schema (src/lib/server/db/schema.ts) onto the temp
	// file, the same way `npm run db:push` does for local dev - so this
	// stays in sync with the actual schema automatically, no separate
	// test-schema file to maintain.
	execSync('npx drizzle-kit push --force', {
		env: { ...process.env, DATABASE_URL: dbUrl },
		stdio: 'pipe'
	});
}
