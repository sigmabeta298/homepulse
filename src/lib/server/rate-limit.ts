// Minimum gap allowed between two accepted /api/ingest requests from the
// same device. 2 seconds comfortably allows any realistic use of this
// project - your fastest ever test interval was 10s, continuous mode
// normally runs at 30-300s, and even manual button-mashing in spot mode
// wouldn't legitimately need sub-2-second repeats. Anything faster than
// that is either a bug (a runaway firmware loop) or abuse (someone
// hammering the endpoint), not real sensor data.
export const MIN_INGEST_INTERVAL_MS = 2000;

// Pure function, no DB/HTTP involved, so it's trivial to unit test.
// Returns true if a new request should be ALLOWED given when the last one
// from this device was accepted.
export function isIngestAllowed(
	lastIngestAt: Date | null,
	now: Date = new Date(),
	minIntervalMs: number = MIN_INGEST_INTERVAL_MS
): boolean {
	if (!lastIngestAt) return true; // first-ever request from this device
	return now.getTime() - lastIngestAt.getTime() >= minIntervalMs;
}
