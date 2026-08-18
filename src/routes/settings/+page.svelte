<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Local mirror so the "parked room" dropdown can be hidden/shown as the
	// user toggles mode, without a full page reload. Re-synced whenever the
	// server data changes (e.g. after a successful save).
	let selectedMode = $state(data.settings.mode);
	$effect(() => {
		selectedMode = data.settings.mode;
	});
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-gray-800">Settings</h1>
		<p class="mt-2 text-gray-600">
			Configure HomePulse application preferences, capture mode, and rooms.
		</p>
	</div>

	{#if form?.success}
		<div class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
			Settings saved.
		</div>
	{/if}
	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<form method="POST" action="?/save" use:enhance>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="rounded-xl border border-indigo-100 bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-semibold text-gray-800">Capture Mode</h2>

				<div class="space-y-4 text-sm">
					<div>
						<label for="mode" class="mb-2 block text-gray-700">Mode</label>
						<select
							id="mode"
							name="mode"
							bind:value={selectedMode}
							class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
						>
							<option value="continuous">Continuous — parked in one room</option>
							<option value="spot">Spot-check — walking room to room</option>
						</select>
						<p class="mt-1 text-xs text-gray-400">
							{#if selectedMode === 'continuous'}
								The device posts on its own timer, all tagged to the room below. Dashboard and
								History reflect this room.
							{:else}
								Arm a room from the Compare page, then press the capture button — each reading
								gets tagged to whichever room was armed.
							{/if}
						</p>
					</div>

					{#if selectedMode === 'continuous'}
						<div>
							<label for="continuousRoomId" class="mb-2 block text-gray-700">
								Currently parked in
							</label>
							<select
								id="continuousRoomId"
								name="continuousRoomId"
								value={data.settings.continuousRoomId ?? ''}
								class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
							>
								<option value="" disabled>Select a room</option>
								{#each data.rooms as r (r.id)}
									<option value={r.id}>{r.name}</option>
								{/each}
							</select>
						</div>
					{:else}
						<input type="hidden" name="continuousRoomId" value="" />
					{/if}
				</div>
			</div>

			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-semibold text-gray-800">General Preferences</h2>

				<div class="space-y-4 text-sm">
					<div>
						<label for="temperatureUnit" class="mb-2 block text-gray-700">
							Temperature Unit
						</label>
						<select
							id="temperatureUnit"
							name="temperatureUnit"
							value={data.settings.temperatureUnit}
							class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
						>
							<option value="C">Celsius (°C)</option>
							<option value="F">Fahrenheit (°F)</option>
						</select>
					</div>

					<div>
						<label for="refreshIntervalSeconds" class="mb-2 block text-gray-700">
							Data Refresh Interval (seconds)
						</label>
						<input
							type="number"
							id="refreshIntervalSeconds"
							name="refreshIntervalSeconds"
							value={data.settings.refreshIntervalSeconds}
							min="10"
							class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
						/>
						<p class="mt-1 text-xs text-gray-400">
							The dashboard re-fetches the latest reading on this interval automatically.
						</p>
					</div>
				</div>
			</div>

		</div>

		<button
			type="submit"
			class="mt-6 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
		>
			Save Settings
		</button>
	</form>

	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-xl font-semibold text-gray-800">Rooms</h2>

		{#if form?.roomError}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
				{form.roomError}
			</div>
		{/if}

		{#if data.rooms.length === 0}
			<p class="mb-4 text-sm text-gray-500">
				No rooms yet — add the rooms you want to monitor or compare below.
			</p>
		{:else}
			<ul class="mb-4 space-y-2">
				{#each data.rooms as r (r.id)}
					<li class="flex items-center gap-2 rounded-lg border bg-gray-50 p-2 text-sm">
						<form method="POST" action="?/renameRoom" use:enhance class="flex flex-1 items-center gap-2">
							<input type="hidden" name="roomId" value={r.id} />
							<input
								type="text"
								name="name"
								value={r.name}
								class="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-gray-300 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500"
							/>
							<button type="submit" class="text-xs text-indigo-600 hover:text-indigo-800">
								Save
							</button>
						</form>
						<form method="POST" action="?/deleteRoom" use:enhance>
							<input type="hidden" name="roomId" value={r.id} />
							<button type="submit" class="text-xs text-red-500 hover:text-red-700"> Remove </button
							>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/addRoom" use:enhance class="flex gap-2">
			<input
				type="text"
				name="name"
				placeholder="e.g. Bedroom 2"
				required
				class="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
			/>
			<button
				type="submit"
				class="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
			>
				Add Room
			</button>
		</form>
	</div>
</div>
