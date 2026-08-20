import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';
import { handle as authHandle } from '$lib/server/auth';
import { isEmailAllowed } from '$lib/server/auth-allowlist';
import { env } from '$env/dynamic/private';

// Paths that must stay reachable without a login session:
// - /login and /auth/* : the sign-in flow itself (would otherwise be an
//   infinite redirect loop - can't log in to a page you need to be
//   logged in to reach).
// - /api/ingest : the ESP32 has no browser, no cookies, no Google
//   account. It authenticates with its own x-api-key header, entirely
//   separately from this login system. Gating this would break the
//   physical device.
// - PWA/static assets : manifest, service worker, icons, robots.txt.
//   Harmless to leave public, and blocking them breaks "Add to Home
//   Screen" behaving normally even before you've logged in on a device.
const PUBLIC_PATH_PREFIXES = [
	'/login',
	'/auth',
	'/api/ingest',
	'/manifest.json',
	'/sw.js',
	'/icons',
	'/robots.txt'
];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATH_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
	);
}

const requireAuth: Handle = async ({ event, resolve }) => {
	if (isPublicPath(event.url.pathname)) {
		return resolve(event);
	}

	const session = await event.locals.auth();

	// Two checks, deliberately not merged into one: a session existing at
	// all (signed in via Google) is separate from that email still being
	// allowed. Re-checking the allowlist here - not just relying on the
	// signIn callback that ran once at login - means revoking access
	// (editing ALLOWED_EMAILS and redeploying) takes effect on someone's
	// very next request, rather than only the next time they happen to
	// sign out and back in on a session that can otherwise last 400 days.
	if (!session?.user || !isEmailAllowed(session.user.email, env.ALLOWED_EMAILS)) {
		throw redirect(303, `/login?from=${encodeURIComponent(event.url.pathname)}`);
	}

	return resolve(event);
};

export const handle = sequence(authHandle, requireAuth);
