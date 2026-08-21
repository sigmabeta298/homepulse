<script lang="ts">
	import { goto } from '$app/navigation';
	import LineChart from '$lib/components/LineChart.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type ReadingKey = 'temperatureC' | 'humidityPct' | 'pm1UgM3' | 'pm25UgM3' | 'pm10UgM3';

	// 'readings' view (24h / 7d / month): one point per raw reading.
	const toReadingPoints = (key: ReadingKey) =>
		data.view === 'readings'
			? data.readings
					.filter((r) => r[key] !== null)
					.map((r) => ({ x: new Date(r.recordedAt).getTime(), y: r[key] as number }))
			: [];

	// 'historic' view: one point per completed month, using that month's
	// average (monthlySummary is all raw readings for that month have
	// left behind once retention.ts rotates and deletes them).
	const summaryAvgKey = {
		temperatureC: 'avgTemperatureC',
		humidityPct: 'avgHumidityPct',
		pm1UgM3: 'avgPm1UgM3',
		pm25UgM3: 'avgPm25UgM3',
		pm10UgM3: 'avgPm10UgM3'
	} as const;

	const toHistoricPoints = (key: ReadingKey) =>
		data.view === 'historic'
			? data.summaries
					.filter((s) => s[summaryAvgKey[key]] !== null)
					.map((s) => ({
						x: Date.UTC(s.year, s.month - 1, 1),
						y: s[summaryAvgKey[key]] as number
					}))
			: [];

	const tempPoints = $derived(data.view === 'historic' ? toHistoricPoints('temperatureC') : toReadingPoints('temperatureC'));
	const humidityPoints = $derived(data.view === 'historic' ? toHistoricPoints('humidityPct') : toReadingPoints('humidityPct'));
	const pm1Points = $derived(data.view === 'historic' ? toHistoricPoints('pm1UgM3') : toReadingPoints('pm1UgM3'));
	const pm25Points = $derived(data.view === 'historic' ? toHistoricPoints('pm25UgM3') : toReadingPoints('pm25UgM3'));
	const pm10Points = $derived(data.view === 'historic' ? toHistoricPoints('pm10UgM3') : toReadingPoints('pm10UgM3'));

	const rangeLabels: Record<string, string> = {
		'24h': 'Last 24 Hours',
		'7d': 'Last 7 Days',
		month: 'This Month',
		historic: 'Historic'
	};

	function setRange(range: string) {
		const params = new URLSearchParams(window.location.search);
		params.set('range', range);
		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	function setRoom(e: Event) {
		const params = new URLSearchParams(window.location.search);
		params.set('room', (e.currentTarget as HTMLSelectElement).value);
		goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-gray-800">History & Trends</h1>
	<p class="text-gray-600">Historical data across all monitored environmental parameters.</p>

	<div class="flex flex-wrap items-center gap-4">
		<div class="flex gap-2">
			{#each ['24h', '7d', 'month', 'historic'] as r}
				<button
					class="rounded-lg border px-4 py-2 {data.range === r
						? 'bg-indigo-600 text-white'
						: 'bg-gray-100 hover:bg-gray-200'}"
					onclick={() => setRange(r)}
				>
					{rangeLabels[r]}
				</button>
			{/each}
		</div>

		{#if data.rooms.length > 0}
			<select
				class="rounded-lg border border-gray-300 p-2 text-sm"
				value={data.roomId ?? ''}
				onchange={setRoom}
			>
				{#each data.rooms as r (r.id)}
					<option value={r.id}>{r.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if data.view === 'historic'}
		<p class="text-sm text-gray-500">
			Showing monthly averages. Once a month fully ends, its raw readings are compressed into a
			single summary row and this history builds up over time.
			{#if data.summaries.length === 0}
				No completed months yet for this room.
			{/if}
		</p>
	{/if}

	<div class="rounded-xl border border-blue-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Temperature (°C)</h2>
		<LineChart points={tempPoints} color="#16a34a" unit="°C" />
	</div>

	<div class="rounded-xl border border-yellow-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Humidity (%)</h2>
		<LineChart points={humidityPoints} color="#ca8a04" unit="%" />
	</div>

	<div class="rounded-xl border border-teal-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">PM1.0 (µg/m³)</h2>
		<LineChart points={pm1Points} color="#0d9488" unit=" µg/m³" />
	</div>

	<div class="rounded-xl border border-blue-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">PM2.5 (µg/m³)</h2>
		<LineChart points={pm25Points} color="#2563eb" unit=" µg/m³" />
	</div>

	<div class="rounded-xl border border-indigo-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">PM10 (µg/m³)</h2>
		<LineChart points={pm10Points} color="#4f46e5" unit=" µg/m³" />
	</div>
</div>
