import { describe, it, expect } from 'vitest';
import { evaluateReading } from './environment-rules';

describe('evaluateReading', () => {
	it('returns no suggestions when every value is within range', () => {
		const result = evaluateReading({
			temperatureC: 24,
			humidityPct: 50,
			pm1UgM3: 5,
			pm25UgM3: 10,
			pm10UgM3: 15
		});
		expect(result).toEqual([]);
	});

	it('flags high temperature with the fan suggestion', () => {
		const result = evaluateReading({ temperatureC: 30 });
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ metric: 'temperatureC', direction: 'above' });
		expect(result[0].message).toMatch(/fan/i);
	});

	it('does not flag low temperature (no below_suggestion configured)', () => {
		const result = evaluateReading({ temperatureC: 15 });
		expect(result).toEqual([]);
	});

	it('flags both low and high humidity with different messages', () => {
		const low = evaluateReading({ humidityPct: 30 });
		expect(low[0].direction).toBe('below');
		expect(low[0].message).toMatch(/dry/i);

		const high = evaluateReading({ humidityPct: 75 });
		expect(high[0].direction).toBe('above');
		expect(high[0].message).toMatch(/exhaust|window/i);
	});

	it('never suggests AC anywhere, for any metric', () => {
		const allBreached = evaluateReading({
			temperatureC: 35,
			humidityPct: 90,
			pm1UgM3: 100,
			pm25UgM3: 100,
			pm10UgM3: 100
		});
		expect(allBreached.length).toBeGreaterThan(0);
		for (const s of allBreached) {
			expect(s.message.toLowerCase()).not.toMatch(/\bac\b/);
			expect(s.message.toLowerCase()).not.toContain('air condition');
		}
	});

	it('flags all three PM metrics independently when all are high', () => {
		const result = evaluateReading({ pm1UgM3: 50, pm25UgM3: 60, pm10UgM3: 80 });
		const metrics = result.map((s) => s.metric).sort();
		expect(metrics).toEqual(['pm10UgM3', 'pm1UgM3', 'pm25UgM3']);
	});

	it('ignores fields that are null, undefined, or missing entirely', () => {
		expect(evaluateReading({ temperatureC: null })).toEqual([]);
		expect(evaluateReading({ temperatureC: undefined })).toEqual([]);
		expect(evaluateReading({})).toEqual([]);
	});

	it('does not flag a value exactly at the boundary', () => {
		// max is 28 for temperatureC - exactly 28 should NOT count as a breach
		expect(evaluateReading({ temperatureC: 28 })).toEqual([]);
		expect(evaluateReading({ temperatureC: 28.01 })).toHaveLength(1);
	});
});
