import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { armedRoom, captureRequest, device, reading, room } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { ARM_WINDOW_MS, getOrCreateSettings, SETTINGS_ID } from '$lib/server/settings';
import { evaluateReading } from '$lib/server/environment-rules';
import { fail } from '@sveltejs/kit';
import {
	CAPTURE_REQUEST_ID,
	getPendingCaptureRequestId,
	queueCaptureRequest
} from '$lib/server/capture-request';

export const load: PageServerLoad = async () => {
	const settingsRow = await getOrCreateSettings();
	const refreshIntervalSeconds = settingsRow.refreshIntervalSeconds;
	const [captureRequestRow] = await db
		.select()
		.from(captureRequest)
		.where(eq(captureRequest.id, CAPTURE_REQUEST_ID));
	const capturePending = await getPendingCaptureRequestId();
	const captureStatus = captureRequestRow
		? { ...captureRequestRow, pending: capturePending !== null }
		: null;

	// The dashboard only really means something in continuous mode: "here's
	// the latest reading for the room I'm parked in." In spot-check mode
	// there's no single "current" room, so we just tell the page that and
	// point the user to Compare instead.
	if (settingsRow.mode !== 'continuous' || !settingsRow.continuousRoomId) {
		return {
			mode: settingsRow.mode,
			latest: null,
			roomName: null,
			suggestions: [],
			refreshIntervalSeconds,
			captureRequest: captureStatus
		};
	}

	const [parkedRoom] = await db
		.select()
		.from(room)
		.where(eq(room.id, settingsRow.continuousRoomId));

	const [latest] = await db
		.select({
			id: reading.id,
			deviceName: device.name,
			temperatureC: reading.temperatureC,
			humidityPct: reading.humidityPct,
			pm1UgM3: reading.pm1UgM3,
			pm25UgM3: reading.pm25UgM3,
			pm10UgM3: reading.pm10UgM3,
			recordedAt: reading.recordedAt
		})
		.from(reading)
		.innerJoin(device, eq(reading.deviceId, device.id))
		.where(and(eq(reading.mode, 'continuous'), eq(reading.roomId, settingsRow.continuousRoomId)))
		.orderBy(desc(reading.recordedAt))
		.limit(1);

	return {
		mode: settingsRow.mode,
		latest: latest ?? null,
		roomName: parkedRoom?.name ?? null,
		suggestions: latest ? evaluateReading(latest) : [],
		refreshIntervalSeconds,
		captureRequest: captureStatus
	};
};

export const actions: Actions = {
	captureNow: async () => {
		if (await getPendingCaptureRequestId()) {
			return fail(409, { captureError: 'A capture request is already waiting for the device.' });
		}

		const settingsRow = await getOrCreateSettings();
		if (settingsRow.mode === 'continuous') {
			await queueCaptureRequest({
				mode: 'continuous',
				roomId: settingsRow.continuousRoomId
			});
		} else {
			const [arming] = await db.select().from(armedRoom).where(eq(armedRoom.id, SETTINGS_ID));
			const armedRoomId = arming?.roomId;
			const armedRoundId = arming?.roundId;
			const armToken = arming?.armToken;
			const armedTimestamp = arming?.armedAt;
			if (
				!armedRoomId ||
				!armedRoundId ||
				!armToken ||
				!armedTimestamp ||
				Date.now() - new Date(armedTimestamp).getTime() >= ARM_WINDOW_MS
			) {
				return fail(400, {
					captureError: 'Arm a room in Room Comparison before requesting a capture.'
				});
			}
			await queueCaptureRequest({
				mode: 'spot',
				roomId: armedRoomId,
				roundId: armedRoundId,
				armToken
			});
		}
		return { captureQueued: true };
	}
};
