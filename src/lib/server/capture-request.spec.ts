import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { captureRequest } from '$lib/server/db/schema';
import {
	completeCaptureRequest,
	getPendingCaptureRequestId,
	queueCaptureRequest
} from './capture-request';

beforeEach(async () => {
	await db.delete(captureRequest);
});

describe('capture requests', () => {
	it('remains pending until a matching reading completes it', async () => {
		const requestId = await queueCaptureRequest();

		expect(await getPendingCaptureRequestId()).toBe(requestId);

		await completeCaptureRequest(requestId);

		expect(await getPendingCaptureRequestId()).toBeNull();
	});

	it('does not let an old request complete a newer request', async () => {
		const oldRequestId = await queueCaptureRequest();
		const newRequestId = await queueCaptureRequest();

		await completeCaptureRequest(oldRequestId);

		expect(await getPendingCaptureRequestId()).toBe(newRequestId);
	});
});
