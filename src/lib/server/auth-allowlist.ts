// This is the real access-control boundary for HomePulse - not Google's
// own "Testing" mode test-user list. That's a reasonable extra layer, but
// it's Google's UI, configured by hand, and not something this app can
// verify or trust blindly (a misconfigured consent screen, or one that
// silently moved to "In production," would let anyone with a Google
// account in). This function is what actually decides who gets access,
// checked server-side on every sign-in regardless of what Google allowed
// through.

function parseAllowedEmails(allowedEmailsEnv: string | undefined): string[] {
	if (!allowedEmailsEnv) return [];
	return allowedEmailsEnv
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter((e) => e.length > 0);
}

export function isEmailAllowed(email: string | null | undefined, allowedEmailsEnv: string | undefined): boolean {
	if (!email) return false;

	const allowed = parseAllowedEmails(allowedEmailsEnv);
	// Fail closed: an empty/unset allowlist means nobody gets in, not
	// everybody. A misconfigured env var should lock the house, not open it.
	if (allowed.length === 0) return false;

	return allowed.includes(email.trim().toLowerCase());
}
