import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { captureRequest, room, round } from '$lib/server/db/schema';
import {
	completeCaptureRequest,
	getPendingCaptureRequest,
	getPendingCaptureRequestId,
	queueCaptureRequest
} from './capture-request';

beforeEach(async () => {
	await db.delete(captureRequest);
});

describe('capture requests', () => {
	it('remains pending until a matching reading completes it', async () => {
		const [roomRow] = await db
			.insert(room)
			.values({ name: 'Bedroom', slug: `bedroom-${crypto.randomUUID()}` })
			.returning();
		const [roundRow] = await db.insert(round).values({}).returning();
		const requestId = await queueCaptureRequest({
			mode: 'spot',
			roomId: roomRow.id,
			roundId: roundRow.id,
			armToken: 'test-arm-token'
		});

		expect(await getPendingCaptureRequestId()).toBe(requestId);
		const request = await getPendingCaptureRequest(requestId);
		expect(request).toMatchObject({
			mode: 'spot',
			roomId: roomRow.id,
			roundId: roundRow.id,
			armToken: 'test-arm-token'
		});

		await completeCaptureRequest(requestId);

		expect(await getPendingCaptureRequestId()).toBeNull();
	});

	it('does not let an old request complete a newer request', async () => {
		const target = {
			mode: 'continuous' as const,
			roomId: null
		};
		const oldRequestId = await queueCaptureRequest(target);
		const newRequestId = await queueCaptureRequest(target);

		await completeCaptureRequest(oldRequestId);

		expect(await getPendingCaptureRequestId()).toBe(newRequestId);
	});
});
