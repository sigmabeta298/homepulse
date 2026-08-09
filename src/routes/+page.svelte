<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const latest = $derived(data.latest);

	function fmt(value: number | null | undefined, unit: string, digits = 1) {
		if (value === null || value === undefined) return '—';
		return `${value.toFixed(digits)}${unit}`;
	}

	function timeAgo(date: Date | string | null | undefined) {
		if (!date) return 'No data yet';
		const d = new Date(date);
		const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-gray-800">Environmental Dashboard</h1>

	{#if data.mode !== 'continuous'}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
			You're in <strong>Spot-check</strong> mode, so there's no single "current" room to show
			here. Head to <a href="/compare" class="underline">Compare</a> to see your room-by-room
			walkthrough, or switch to Continuous mode in
			<a href="/settings" class="underline">Settings</a>.
		</div>
	{:else if !data.roomName}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
			You're in Continuous mode but haven't picked which room the device is parked in yet. Set
			that in <a href="/settings" class="underline">Settings</a>.
		</div>
	{:else}
		<p class="text-gray-600">
			{#if latest}
				Showing the latest reading from <strong>{data.roomName}</strong>, {timeAgo(
					latest.recordedAt
				)}.
			{:else}
				No readings yet for <strong>{data.roomName}</strong>. Once your ESP32 starts posting to
				<code>/api/ingest</code>, live data will show up here.
			{/if}
		</p>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<div class="rounded-xl border border-green-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-green-600 uppercase">Temperature</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.temperatureC, '°C')}</p>
			</div>
			<div class="rounded-xl border border-yellow-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-yellow-600 uppercase">Humidity</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.humidityPct, '%')}</p>
			</div>
			<div class="rounded-xl border border-blue-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-blue-600 uppercase">
					Air Quality (PM2.5)
				</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.pm25UgM3, ' µg/m³')}</p>
			</div>
			<div class="rounded-xl border border-purple-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-purple-600 uppercase">CO2</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.co2Ppm, ' ppm', 0)}</p>
			</div>
		</div>
	{/if}
</div>
