import { db } from '$lib/server/db';
import { captureRequest } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const CAPTURE_REQUEST_ID = 'default';

type CaptureRequestTarget =
	| { mode: 'continuous'; roomId: string | null }
	| { mode: 'spot'; roomId: string; roundId: string; armToken: string };

export async function queueCaptureRequest(target: CaptureRequestTarget, requestedAt = new Date()) {
	const requestId = crypto.randomUUID();
	await db
		.insert(captureRequest)
		.values({
			id: CAPTURE_REQUEST_ID,
			requestId,
			mode: target.mode,
			roomId: target.roomId,
			roundId: target.mode === 'spot' ? target.roundId : null,
			armToken: target.mode === 'spot' ? target.armToken : null,
			requestedAt,
			completedAt: null
		})
		.onConflictDoUpdate({
			target: captureRequest.id,
			set: {
				requestId,
				mode: target.mode,
				roomId: target.roomId,
				roundId: target.mode === 'spot' ? target.roundId : null,
				armToken: target.mode === 'spot' ? target.armToken : null,
				requestedAt,
				completedAt: null
			}
		});
	return requestId;
}

export async function getPendingCaptureRequest(requestId: string) {
	const [request] = await db
		.select()
		.from(captureRequest)
		.where(eq(captureRequest.requestId, requestId));
	return request && !request.completedAt ? request : null;
}

export async function getPendingCaptureRequestId() {
	const [request] = await db
		.select({ requestId: captureRequest.requestId, completedAt: captureRequest.completedAt })
		.from(captureRequest)
		.where(eq(captureRequest.id, CAPTURE_REQUEST_ID));
	return request && !request.completedAt ? request.requestId : null;
}

export async function completeCaptureRequest(requestId: string, completedAt = new Date()) {
	await db
		.update(captureRequest)
		.set({ completedAt })
		.where(eq(captureRequest.requestId, requestId));
}
