import { describe, it, expect } from 'vitest';
import { isIngestAllowed, MIN_INGEST_INTERVAL_MS } from './rate-limit';

describe('isIngestAllowed', () => {
	it('allows the first-ever request from a device (no prior timestamp)', () => {
		expect(isIngestAllowed(null, new Date())).toBe(true);
	});

	it('blocks a request that arrives before the minimum interval has passed', () => {
		const lastIngestAt = new Date('2026-01-01T00:00:00.000Z');
		const now = new Date(lastIngestAt.getTime() + MIN_INGEST_INTERVAL_MS - 1);
		expect(isIngestAllowed(lastIngestAt, now)).toBe(false);
	});

	it('allows a request that arrives exactly at the minimum interval', () => {
		const lastIngestAt = new Date('2026-01-01T00:00:00.000Z');
		const now = new Date(lastIngestAt.getTime() + MIN_INGEST_INTERVAL_MS);
		expect(isIngestAllowed(lastIngestAt, now)).toBe(true);
	});

	it('allows a request well after the minimum interval', () => {
		const lastIngestAt = new Date('2026-01-01T00:00:00.000Z');
		const now = new Date(lastIngestAt.getTime() + 5 * 60 * 1000); // 5 min later
		expect(isIngestAllowed(lastIngestAt, now)).toBe(true);
	});

	it('respects a custom interval when provided', () => {
		const lastIngestAt = new Date('2026-01-01T00:00:00.000Z');
		const now = new Date(lastIngestAt.getTime() + 500);
		expect(isIngestAllowed(lastIngestAt, now, 1000)).toBe(false);
		expect(isIngestAllowed(lastIngestAt, now, 100)).toBe(true);
	});
});
