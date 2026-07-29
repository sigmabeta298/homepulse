<div class="space-y-6">
    <div>
        <h1 class="text-3xl font-bold text-gray-800">Settings</h1>
        <p class="mt-2 text-gray-600">
            Configure HomePulse application settings, sensor locations, alert thresholds, and system preferences.
        </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- General Settings Card -->
        <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 class="mb-4 text-xl font-semibold text-gray-800">
                General Preferences
            </h2>

            <div class="space-y-4 text-sm">
                <div>
                    <label for="monitoring-units" class="mb-2 block text-gray-700">
                        Monitoring Units
                    </label>

                    <select
                        id="monitoring-units"
                        class="w-full rounded-lg border border-gray-300 p-2 focus:border-indigo-500 focus:ring-indigo-500"
                    >
                        <option>Temperature: Celsius (°C)</option>
                        <option>Temperature: Fahrenheit (°F)</option>
                    </select>
                </div>

                <div>
                    <span class="mb-2 block text-gray-700">
                        Data Refresh Interval
                    </span>

                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50"
                        >
                            1 Minute
                        </button>

                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50"
                        >
                            5 Minutes
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alerts Settings Card -->
        <div class="rounded-xl border border-red-100 bg-white p-6 shadow-lg">
            <h2 class="mb-4 text-xl font-semibold text-gray-800">
                Alert Thresholds
            </h2>

            <div class="space-y-4 text-sm">
                <div>
                    <label for="aqi-threshold" class="mb-2 block text-gray-700">
                        Max Acceptable AQI
                    </label>

                    <input
                        type="number"
                        id="aqi-threshold"
                        value="35"
                        class="w-full rounded-lg border border-gray-300 p-2 focus:border-red-500 focus:ring-red-500"
                    />
                </div>

                <div>
                    <label for="temp-high" class="mb-2 block text-gray-700">
                        High Temperature Alert (&gt;)
                    </label>

                    <input
                        type="number"
                        id="temp-high"
                        value="28"
                        class="w-full rounded-lg border border-gray-300 p-2 focus:border-red-500 focus:ring-red-500"
                    />
                </div>
            </div>
        </div>
    </div>
</div>