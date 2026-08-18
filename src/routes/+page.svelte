<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
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

	const tempBreach = $derived(
		latest?.temperatureC != null && latest.temperatureC > data.tempHighThresholdC
	);
	const aqiBreach = $derived(latest?.pm25UgM3 != null && latest.pm25UgM3 > data.aqiThreshold);

	// Re-runs this page's load function on a timer, using whatever interval
	// is set in Settings. invalidateAll() re-fetches from the server rather
	// than duplicating the query client-side, so this stays in sync with
	// the exact same logic (mode-awareness, thresholds, etc.) as a manual
	// page reload would give you.
	onMount(() => {
		const ms = Math.max(data.refreshIntervalSeconds, 10) * 1000;
		const interval = setInterval(() => {
			invalidateAll();
		}, ms);
		return () => clearInterval(interval);
	});
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
			<span class="text-xs text-gray-400">
				(auto-refreshing every {data.refreshIntervalSeconds}s)
			</span>
		</p>

		{#if data.suggestions.length > 0}
			<div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
				<p class="mb-2 text-sm font-semibold text-amber-800">Suggestions</p>
				<ul class="space-y-1.5 text-sm text-amber-800">
					{#each data.suggestions as s}
						<li class="flex gap-2">
							<span>💡</span>
							<span>
								<strong>{s.label}</strong> is {fmt(s.value, s.unit)} — {s.message}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			<div
				class="rounded-xl border p-6 shadow-lg {tempBreach
					? 'border-red-300 bg-red-50'
					: 'border-green-100 bg-white'}"
			>
				<div
					class="text-sm font-medium tracking-wider uppercase {tempBreach
						? 'text-red-600'
						: 'text-green-600'}"
				>
					Temperature {tempBreach ? '⚠' : ''}
				</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.temperatureC, '°C')}</p>
				{#if tempBreach}
					<p class="mt-1 text-xs text-red-500">Above your {data.tempHighThresholdC}°C alert threshold</p>
				{/if}
			</div>
			<div class="rounded-xl border border-yellow-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-yellow-600 uppercase">Humidity</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.humidityPct, '%')}</p>
			</div>
			<div
				class="rounded-xl border p-6 shadow-lg {aqiBreach
					? 'border-red-300 bg-red-50'
					: 'border-blue-100 bg-white'}"
			>
				<div
					class="text-sm font-medium tracking-wider uppercase {aqiBreach
						? 'text-red-600'
						: 'text-blue-600'}"
				>
					Air Quality (PM2.5) {aqiBreach ? '⚠' : ''}
				</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.pm25UgM3, ' µg/m³')}</p>
				{#if aqiBreach}
					<p class="mt-1 text-xs text-red-500">Above your {data.aqiThreshold} µg/m³ alert threshold</p>
				{/if}
			</div>
			<div class="rounded-xl border border-teal-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-teal-600 uppercase">PM1.0</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.pm1UgM3, ' µg/m³')}</p>
			</div>
			<div class="rounded-xl border border-indigo-100 bg-white p-6 shadow-lg">
				<div class="text-sm font-medium tracking-wider text-indigo-600 uppercase">PM10</div>
				<p class="mt-1 text-4xl font-bold">{fmt(latest?.pm10UgM3, ' µg/m³')}</p>
			</div>
		</div>
	{/if}
</div>
