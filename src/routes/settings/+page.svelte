<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold text-gray-800">Settings</h1>
		<p class="mt-2 text-gray-600">
			Configure HomePulse application preferences and alert thresholds.
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
							Not yet wired to the dashboard's auto-refresh — stored for when that's added.
						</p>
					</div>
				</div>
			</div>

			<div class="rounded-xl border border-red-100 bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-semibold text-gray-800">Alert Thresholds</h2>

				<div class="space-y-4 text-sm">
					<div>
						<label for="aqiThreshold" class="mb-2 block text-gray-700"> Max Acceptable PM2.5 </label>
						<input
							type="number"
							id="aqiThreshold"
							name="aqiThreshold"
							value={data.settings.aqiThreshold}
							step="0.1"
							class="w-full rounded-lg border border-gray-300 p-2 focus:border-red-500 focus:ring-red-500"
						/>
					</div>

					<div>
						<label for="tempHighThresholdC" class="mb-2 block text-gray-700">
							High Temperature Alert (°C, &gt;)
						</label>
						<input
							type="number"
							id="tempHighThresholdC"
							name="tempHighThresholdC"
							value={data.settings.tempHighThresholdC}
							step="0.1"
							class="w-full rounded-lg border border-gray-300 p-2 focus:border-red-500 focus:ring-red-500"
						/>
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
</div>
