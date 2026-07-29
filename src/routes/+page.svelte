<div class="space-y-6">
    <h1 class="text-3xl font-bold text-gray-800">Environmental Dashboard</h1>
    <p class="text-gray-600">Welcome to the main dashboard for HomePulse. This section will display an overview of current readings (Temp, Humidity, AQI).</p>

    <!-- Placeholder for primary widgets -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-lg border border-green-100">
            <div class="text-sm font-medium text-green-600 uppercase tracking-wider">Temperature</div>
            <p class="text-4xl font-bold mt-1">22.5°C</p>
            <p class="text-sm text-gray-400 mt-2">Stable reading</p>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-lg border border-yellow-100">
            <div class="text-sm font-medium text-yellow-600 uppercase tracking-wider">Humidity</div>
            <p class="text-4xl font-bold mt-1">45%</p>
            <p class="text-sm text-gray-400 mt-2">Normal range</p>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-lg border border-blue-100">
            <div class="text-sm font-medium text-blue-600 uppercase tracking-wider">Air Quality (PM2.5)</div>
            <p class="text-4xl font-bold mt-1">12 µg/m³</p>
            <p class="text-sm text-gray-400 mt-2">Good Air Quality</p>
        </div>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-lg border">
        <h2 class="text-xl font-semibold mb-4">Recent Activity Feed</h2>
        <ul class="divide-y divide-gray-200">
            <li class="py-3 flex justify-between items-center">
                <span class="text-gray-700">Temperature reading updated.</span>
                <span class="text-sm text-gray-500">5 minutes ago</span>
            </li>
            <li class="py-3 flex justify-between items-center">
                <span class="text-gray-700">Humidity spiked slightly.</span>
                <span class="text-sm text-gray-500">1 hour ago</span>
            </li>
        </ul>
    </div>
</div>