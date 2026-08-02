import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

const SETTINGS_ID = 'default';

async function getOrCreateSettings() {
	const [existing] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
	if (existing) return existing;

	const [created] = await db.insert(settings).values({ id: SETTINGS_ID }).returning();
	return created;
}

export const load: PageServerLoad = async () => {
	return { settings: await getOrCreateSettings() };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();

		const temperatureUnit = form.get('temperatureUnit');
		const refreshIntervalSeconds = Number(form.get('refreshIntervalSeconds'));
		const aqiThreshold = Number(form.get('aqiThreshold'));
		const tempHighThresholdC = Number(form.get('tempHighThresholdC'));

		if (temperatureUnit !== 'C' && temperatureUnit !== 'F') {
			return fail(400, { error: 'Invalid temperature unit' });
		}
		if (
			!Number.isFinite(refreshIntervalSeconds) ||
			!Number.isFinite(aqiThreshold) ||
			!Number.isFinite(tempHighThresholdC)
		) {
			return fail(400, { error: 'All threshold fields must be numbers' });
		}

		await getOrCreateSettings(); // ensure row exists before updating

		await db
			.update(settings)
			.set({ temperatureUnit, refreshIntervalSeconds, aqiThreshold, tempHighThresholdC })
			.where(eq(settings.id, SETTINGS_ID));

		return { success: true };
	}
};
