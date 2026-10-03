import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getOrCreateSettings } from '$lib/server/settings';
import { getPendingCaptureRequestId } from '$lib/server/capture-request';

// The ESP32 uses this authenticated endpoint to follow capture-mode
// changes made in the web application without reflashing its local config.
export const GET: RequestHandler = async ({ request }) => {
	const apiKey = request.headers.get('x-api-key');
	if (!env.INGEST_API_KEY || apiKey !== env.INGEST_API_KEY) {
		throw error(401, 'Unauthorized');
	}

	const [settingsRow, captureRequestId] = await Promise.all([
		getOrCreateSettings(),
		getPendingCaptureRequestId()
	]);
	return json(
		{ mode: settingsRow.mode, captureRequestId },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
