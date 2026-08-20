import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/core/providers/google';
import { env } from '$env/dynamic/private';
import { isEmailAllowed } from '$lib/server/auth-allowlist';

// 400 days is the practical ceiling here, not an arbitrary choice - modern
// browsers (Chrome since 2023, and others followed) cap cookie Max-Age at
// 400 days regardless of what a site asks for. Setting anything longer
// wouldn't actually keep you logged in any longer, so this is genuinely
// "as long as technically possible" rather than a number we made up.
const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	providers: [
		Google({
			clientId: env.AUTH_GOOGLE_ID,
			clientSecret: env.AUTH_GOOGLE_SECRET
		})
	],
	session: {
		strategy: 'jwt',
		maxAge: SESSION_MAX_AGE_SECONDS
	},
	pages: {
		signIn: '/login'
	},
	callbacks: {
		// This is the real access gate - see auth-allowlist.ts for why it's
		// not just a defense-in-depth extra on top of Google's own
		// "Testing" mode restriction. Returning false here rejects the
		// sign-in outright, before any session/cookie is ever created.
		async signIn({ user }) {
			return isEmailAllowed(user.email, env.ALLOWED_EMAILS);
		}
	}
});
