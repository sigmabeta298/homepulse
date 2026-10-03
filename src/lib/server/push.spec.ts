import { describe, expect, it } from 'vitest';
import { parsePushSubscription } from './push';

describe('parsePushSubscription', () => {
	const validSubscription = {
		endpoint: 'https://fcm.googleapis.com/fcm/send/test-subscription',
		keys: { p256dh: 'public-key', auth: 'auth-secret' }
	};

	it('accepts an HTTPS browser push endpoint and its keys', () => {
		expect(parsePushSubscription(validSubscription)).toEqual({
			endpoint: validSubscription.endpoint,
			p256dh: 'public-key',
			auth: 'auth-secret'
		});
	});

	it('rejects malformed and non-provider endpoints', () => {
		expect(parsePushSubscription(null)).toBeNull();
		expect(
			parsePushSubscription({
				...validSubscription,
				endpoint: 'http://fcm.googleapis.com/fcm/send/test'
			})
		).toBeNull();
		expect(
			parsePushSubscription({
				...validSubscription,
				endpoint: 'https://attacker.example/send'
			})
		).toBeNull();
	});
});
