import { parse } from 'yaml';
// Imported as raw text (bundled at build time, not read from disk at
// runtime) so this works identically in dev and once deployed to
// Vercel's serverless functions - no dependency on which files happen
// to be included in the deployed function's filesystem.
import rulesYaml from './environment-rules.yaml?raw';

export type MetricKey = 'temperatureC' | 'humidityPct' | 'pm1UgM3' | 'pm25UgM3' | 'pm10UgM3';

type MetricRule = {
	label: string;
	unit: string;
	min: number | null;
	max: number | null;
	below_suggestion: string | null;
	above_suggestion: string | null;
};

type RulesFile = {
	metrics: Record<MetricKey, MetricRule>;
};

const rules = parse(rulesYaml) as RulesFile;

export type Suggestion = {
	metric: MetricKey;
	label: string;
	value: number;
	unit: string;
	direction: 'below' | 'above';
	message: string;
};

export type ReadingLike = Partial<Record<MetricKey, number | null | undefined>>;

// Checks a reading against every configured metric's range and returns
// one Suggestion per breach that actually has a message configured (a
// breach with a null suggestion - e.g. low temperature - is silently
// skipped, since there's deliberately nothing useful to say there).
export function evaluateReading(reading: ReadingLike): Suggestion[] {
	const suggestions: Suggestion[] = [];

	for (const [metric, rule] of Object.entries(rules.metrics) as [MetricKey, MetricRule][]) {
		const value = reading[metric];
		if (value === null || value === undefined) continue;

		if (rule.min !== null && value < rule.min && rule.below_suggestion) {
			suggestions.push({
				metric,
				label: rule.label,
				value,
				unit: rule.unit,
				direction: 'below',
				message: rule.below_suggestion
			});
		} else if (rule.max !== null && value > rule.max && rule.above_suggestion) {
			suggestions.push({
				metric,
				label: rule.label,
				value,
				unit: rule.unit,
				direction: 'above',
				message: rule.above_suggestion
			});
		}
	}

	return suggestions;
}
