<script lang="ts">
	type Point = { x: number; y: number };

	let {
		points,
		color = '#2563eb',
		unit = '',
		height = 240
	}: {
		points: Point[];
		color?: string;
		unit?: string;
		height?: number;
	} = $props();

	const width = 800;
	const padding = 32;

	const validPoints = $derived(points.filter((p) => p.y !== null && !Number.isNaN(p.y)));

	const yMin = $derived(validPoints.length ? Math.min(...validPoints.map((p) => p.y)) : 0);
	const yMax = $derived(validPoints.length ? Math.max(...validPoints.map((p) => p.y)) : 1);
	const yRange = $derived(yMax - yMin || 1);

	const xMin = $derived(validPoints.length ? Math.min(...validPoints.map((p) => p.x)) : 0);
	const xMax = $derived(validPoints.length ? Math.max(...validPoints.map((p) => p.x)) : 1);
	const xRange = $derived(xMax - xMin || 1);

	function scaleX(x: number) {
		return padding + ((x - xMin) / xRange) * (width - padding * 2);
	}
	function scaleY(y: number) {
		return height - padding - ((y - yMin) / yRange) * (height - padding * 2);
	}

	const path = $derived(
		validPoints.length
			? validPoints
					.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`)
					.join(' ')
			: ''
	);
</script>

{#if validPoints.length === 0}
	<div
		class="flex h-60 items-center justify-center rounded-lg border border-dashed text-gray-400"
	>
		No data yet
	</div>
{:else}
	<svg viewBox="0 0 {width} {height}" class="w-full" style="height: {height}px">
		<line
			x1={padding}
			y1={height - padding}
			x2={width - padding}
			y2={height - padding}
			stroke="#e5e7eb"
		/>
		<line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" />

		<text x={padding} y={padding - 8} font-size="12" fill="#6b7280">
			{yMax.toFixed(1)}{unit}
		</text>
		<text x={padding} y={height - padding + 16} font-size="12" fill="#6b7280">
			{yMin.toFixed(1)}{unit}
		</text>

		<path d={path} fill="none" stroke={color} stroke-width="2" />
	</svg>
{/if}
