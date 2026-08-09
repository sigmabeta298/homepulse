<script lang="ts">
	import { goto } from '$app/navigation';
	import LineChart from '$lib/components/LineChart.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const toPoints = (key: 'temperatureC' | 'humidityPct' | 'co2Ppm' | 'pm25UgM3') =>
		data.readings
			.filter((r) => r[key] !== null)
			.map((r) => ({ x: new Date(r.recordedAt).getTime(), y: r[key] as number }));

	const tempPoints = $derived(toPoints('temperatureC'));
	const humidityPoints = $derived(toPoints('humidityPct'));
	const co2Points = $derived(toPoints('co2Ppm'));
	const pm25Points = $derived(toPoints('pm25UgM3'));

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
			{#each ['24h', '7d', '30d'] as r}
				<button
					class="rounded-lg border px-4 py-2 {data.range === r
						? 'bg-indigo-600 text-white'
						: 'bg-gray-100 hover:bg-gray-200'}"
					onclick={() => setRange(r)}
				>
					{r === '24h' ? 'Last 24 Hours' : r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
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

	<div class="rounded-xl border border-blue-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Temperature (°C)</h2>
		<LineChart points={tempPoints} color="#16a34a" unit="°C" />
	</div>

	<div class="rounded-xl border border-yellow-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">Humidity (%)</h2>
		<LineChart points={humidityPoints} color="#ca8a04" unit="%" />
	</div>

	<div class="rounded-xl border border-purple-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">CO2 (ppm)</h2>
		<LineChart points={co2Points} color="#9333ea" unit=" ppm" />
	</div>

	<div class="rounded-xl border border-blue-100 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold">PM2.5 (µg/m³)</h2>
		<LineChart points={pm25Points} color="#2563eb" unit=" µg/m³" />
	</div>
</div>
