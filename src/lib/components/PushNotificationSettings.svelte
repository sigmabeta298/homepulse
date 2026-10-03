<script lang="ts">
	import { onMount } from 'svelte';

	type PushStatus = {
		configured: boolean;
		publicKey: string | null;
		subscriptionCount: number;
	};

	let pushStatus = $state<PushStatus | null>(null);
	let currentDeviceSubscribed = $state(false);
	let busy = $state(false);
	let message = $state('');

	async function readStatus() {
		const response = await fetch('/api/push/subscriptions', { cache: 'no-store' });
		if (!response.ok) throw new Error(`Could not load notification status (${response.status}).`);
		pushStatus = (await response.json()) as PushStatus;

		if ('serviceWorker' in navigator && 'PushManager' in window) {
			const registration = await navigator.serviceWorker.ready;
			currentDeviceSubscribed = Boolean(await registration.pushManager.getSubscription());
		}
	}

	onMount(() => {
		if (
			!('serviceWorker' in navigator) ||
			!('PushManager' in window) ||
			!('Notification' in window)
		) {
			message = 'Push notifications are not supported by this browser.';
			return;
		}

		void readStatus().catch((cause: unknown) => {
			message = cause instanceof Error ? cause.message : 'Could not load notification settings.';
		});
	});

	function decodeApplicationServerKey(value: string): ArrayBuffer {
		const padding = '='.repeat((4 - (value.length % 4)) % 4);
		const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
		const decoded = atob(base64);
		const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
		for (let index = 0; index < decoded.length; index += 1) {
			bytes[index] = decoded.charCodeAt(index);
		}
		return bytes.buffer;
	}

	async function enableNotifications() {
		if (!pushStatus?.configured || !pushStatus.publicKey) return;
		busy = true;
		message = '';
		try {
			if (Notification.permission === 'denied') {
				throw new Error(
					'Notifications are blocked in browser settings. Allow them for HomePulse, then try again.'
				);
			}
			const permission =
				Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
			if (permission !== 'granted') {
				throw new Error(
					'Notification permission was not granted. You can enable it later in browser settings.'
				);
			}

			const registration = await navigator.serviceWorker.ready;
			const existingSubscription = await registration.pushManager.getSubscription();
			const subscription =
				existingSubscription ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: decodeApplicationServerKey(pushStatus.publicKey)
				}));

			const response = await fetch('/api/push/subscriptions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
			if (!response.ok) {
				if (!existingSubscription) await subscription.unsubscribe();
				throw new Error(`Could not save this device's subscription (${response.status}).`);
			}

			await readStatus();
			message = 'Notifications are enabled on this device.';
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not enable notifications.';
		} finally {
			busy = false;
		}
	}

	async function disableNotifications() {
		busy = true;
		message = '';
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) {
				const response = await fetch('/api/push/subscriptions', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				if (!response.ok) {
					throw new Error(`Could not remove this device's subscription (${response.status}).`);
				}
				await subscription.unsubscribe();
			}
			await readStatus();
			message = 'Notifications are disabled on this device.';
		} catch (cause) {
			message = cause instanceof Error ? cause.message : 'Could not disable notifications.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="rounded-xl border border-indigo-100 bg-white p-6 shadow-lg">
	<h2 class="mb-2 text-xl font-semibold text-gray-800">Push Notifications</h2>
	<p class="mb-4 text-sm text-gray-600">
		Get a notification when sensor readings trigger the dashboard's environmental warnings.
		Subscriptions are saved to your signed-in account and can be removed from this device here.
		A notification is sent for each reading that triggers a warning.
	</p>

	{#if pushStatus && !pushStatus.configured}
		<p class="mb-3 text-sm text-amber-700">
			Push delivery is not configured on the server yet. Add the VAPID environment variables and
			redeploy to enable it.
		</p>
	{:else if pushStatus?.subscriptionCount}
		<p class="mb-3 text-sm text-green-700">
			{pushStatus.subscriptionCount} device{pushStatus.subscriptionCount === 1 ? '' : 's'} subscribed
			to this account.
		</p>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		{#if currentDeviceSubscribed}
			<button
				type="button"
				onclick={disableNotifications}
				disabled={busy}
				class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
			>
				{busy ? 'Please wait…' : 'Disable on this device'}
			</button>
		{:else}
			<button
				type="button"
				onclick={enableNotifications}
				disabled={busy || !pushStatus?.configured}
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{busy ? 'Please wait…' : 'Enable notifications on this device'}
			</button>
		{/if}
		{#if message}
			<p role="status" class="text-sm text-gray-600">{message}</p>
		{/if}
	</div>
</section>
