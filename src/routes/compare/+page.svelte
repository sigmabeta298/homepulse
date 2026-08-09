<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function fmt(value: number | null | undefined, unit: string, digits = 1) {
		if (value === null || value === undefined) return '—';
		return `${value.toFixed(digits)}${unit}`;
	}

	function timeLabel(date: Date | string | null | undefined) {
		if (!date) return '';
		return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function roundLabel(startedAt: Date | string) {
		return new Date(startedAt).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold text-gray-800">Room Comparison</h1>
	<p class="text-gray-600">
		Walk the device room to room and compare how they look at roughly the same point in time.
	</p>

	{#if data.mode !== 'spot'}
		<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
			You're currently in <strong>Continuous</strong> mode. Switch to
			<strong>Spot-check</strong> mode in Settings to arm rooms and build a walkthrough.
		</div>
	{/if}

	{#if data.rooms.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
			No rooms set up yet. Add rooms in Settings first.
		</div>
	{:else}
		{#if data.mode === 'spot'}
			<form
				method="POST"
				action="?/arm"
				use:enhance
				class="flex flex-wrap items-end gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-lg"
			>
				<div class="flex-1">
					<label for="roomId" class="mb-1 block text-sm text-gray-700">
						Arm for room, then walk over and press the button on the device
					</label>
					<select
						id="roomId"
						name="roomId"
						class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
					>
						{#each data.rooms as r (r.id)}
							<option value={r.id}>{r.name}</option>
						{/each}
					</select>
				</div>
				<button
					type="submit"
					class="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
				>
					Arm
				</button>
			</form>

			{#if form?.armed}
				<div class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
					Armed for <strong>{form.armedRoomName}</strong> — walk over and press the capture
					button now.
				</div>
			{/if}
			{#if form?.error}
				<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{form.error}
				</div>
			{/if}
		{/if}

		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold">
					{#if data.targetRound}
						Walkthrough — {roundLabel(data.targetRound.startedAt)}
					{:else}
						No walkthrough yet
					{/if}
				</h2>

				{#if data.pastRounds.length > 1}
					<form method="GET" class="text-sm">
						<select
							name="round"
							class="rounded-lg border border-gray-300 p-1.5"
							onchange={(e) => e.currentTarget.form?.submit()}
						>
							{#each data.pastRounds as r (r.id)}
								<option value={r.id} selected={r.id === data.targetRound?.id}>
									{roundLabel(r.startedAt)}
								</option>
							{/each}
						</select>
					</form>
				{/if}
			</div>

			{#if !data.targetRound}
				<p class="text-gray-500">
					Arm a room above and take your first reading to start a walkthrough.
				</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead>
							<tr class="border-b text-gray-500">
								<th class="py-2">Room</th>
								<th class="py-2">Temp</th>
								<th class="py-2">Humidity</th>
								<th class="py-2">CO2</th>
								<th class="py-2">PM2.5</th>
								<th class="py-2">Measured</th>
							</tr>
						</thead>
						<tbody>
							{#each data.roomSnapshots as snap (snap.room.id)}
								<tr class="border-b last:border-0">
									<td class="py-2 font-medium">{snap.room.name}</td>
									{#if snap.reading}
										<td class="py-2">{fmt(snap.reading.temperatureC, '°C')}</td>
										<td class="py-2">{fmt(snap.reading.humidityPct, '%')}</td>
										<td class="py-2">{fmt(snap.reading.co2Ppm, ' ppm', 0)}</td>
										<td class="py-2">{fmt(snap.reading.pm25UgM3, ' µg/m³')}</td>
										<td class="py-2 text-gray-400">{timeLabel(snap.reading.recordedAt)}</td>
									{:else}
										<td class="py-2 text-gray-300" colspan="5">Not measured this round</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
