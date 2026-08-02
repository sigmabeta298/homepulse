<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function timeAgo(date: Date | string | null | undefined) {
		if (!date) return 'Never';
		const d = new Date(date);
		const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}

	const onlineCount = $derived(data.devices.filter((d) => d.isOnline).length);
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-gray-800">Sensors & Devices Management</h1>
	<p class="text-gray-600">
		Devices are added automatically the first time they post a reading to <code>/api/ingest</code
		>. There's nothing to configure here manually yet.
	</p>

	<div class="rounded-xl border border-green-100 bg-white p-6 shadow-lg">
		<h2 class="mb-3 text-xl font-semibold">Device Status Overview</h2>

		{#if data.devices.length === 0}
			<p class="text-gray-500">
				No devices yet. Once your ESP32 posts its first reading, it'll show up here
				automatically.
			</p>
		{:else}
			<p class="mb-4 text-sm text-gray-600">
				{onlineCount} of {data.devices.length} device{data.devices.length === 1 ? '' : 's'} online
			</p>

			<ul class="space-y-3">
				{#each data.devices as d (d.id)}
					<li class="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
						<div>
							<span class="font-medium">{d.name}</span>
							<span class="ml-2 text-sm text-gray-400">({d.slug})</span>
							<p class="text-xs text-gray-400">Last seen: {timeAgo(d.latest?.recordedAt)}</p>
						</div>
						{#if d.isOnline}
							<span class="font-medium text-green-600">● Online</span>
						{:else}
							<span class="font-medium text-gray-400">○ Offline</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
